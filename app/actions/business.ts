"use server"

import { db } from "@/lib/db"
import { business } from "@/lib/db/schema"
import { ACTIVE_BUSINESS_COOKIE, getCurrentUser, requireOwner } from "@/lib/session"
import { ensureCompanyRow } from "@/lib/trial"
import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"

export interface BusinessSummary {
  scopeId: string
  name: string
  active: boolean
}

/**
 * Lists every business the current owner login owns, flagging the active one.
 * Self-heals legacy owners that predate the business table by materialising a
 * default business whose scope is their login id (where their data already lives).
 */
export async function getMyBusinesses(): Promise<BusinessSummary[]> {
  const me = await getCurrentUser()
  if (me.appRole !== "owner") return []

  let rows = await db
    .select({ scopeId: business.scopeId, name: business.name })
    .from(business)
    .where(eq(business.ownerUserId, me.id))
    .orderBy(asc(business.id))

  if (rows.length === 0) {
    // Legacy owner: their existing data is scoped to their login id.
    await db
      .insert(business)
      .values({ scopeId: me.id, ownerUserId: me.id, name: "My business" })
      .onConflictDoNothing({ target: business.scopeId })
    rows = [{ scopeId: me.id, name: "My business" }]
  }

  return rows.map((r) => ({ ...r, active: r.scopeId === me.accountId }))
}

/** Creates a new business (its own data scope) owned by the current login and switches to it. */
export async function createBusiness(formData: FormData) {
  const me = await requireOwner()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) throw new Error("Business name is required")

  const scopeId = `biz_${randomUUID()}`
  await db.insert(business).values({ scopeId, ownerUserId: me.id, name })

  // Start the new business on a fresh 14-day Starter trial immediately.
  await ensureCompanyRow(scopeId)

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, scopeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/", "layout")
  return { scopeId }
}

/** Switches the active business scope for the current owner, validating ownership. */
export async function switchBusiness(scopeId: string) {
  const me = await requireOwner()

  const [owned] = await db
    .select({ scopeId: business.scopeId })
    .from(business)
    .where(eq(business.scopeId, scopeId))
    .limit(1)

  if (!owned) throw new Error("Business not found")

  // Verify the business belongs to this login before switching.
  const mine = await db
    .select({ scopeId: business.scopeId })
    .from(business)
    .where(eq(business.ownerUserId, me.id))
  if (!mine.some((b) => b.scopeId === scopeId)) {
    throw new Error("Not authorized for this business")
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, scopeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/", "layout")
}

/** Renames a business owned by the current login. */
export async function renameBusiness(scopeId: string, name: string) {
  const me = await requireOwner()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Business name is required")

  await db
    .update(business)
    .set({ name: trimmed })
    .where(and(eq(business.ownerUserId, me.id), eq(business.scopeId, scopeId)))

  revalidatePath("/", "layout")
}
