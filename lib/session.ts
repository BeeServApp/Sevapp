import "server-only"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { business, staffMember, user, venue } from "@/lib/db/schema"
import { ensureSeeded } from "@/lib/seed"
import { and, asc, eq, or } from "drizzle-orm"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

export const ACTIVE_VENUE_COOKIE = "tapsheet_active_venue"
export const ACTIVE_BUSINESS_COOKIE = "tapsheet_active_business"

export type AppRole = "owner" | "staff"

export interface CurrentUser {
  id: string
  name: string
  email: string
  appRole: AppRole
  /** The user id whose data this account reads/writes (self for owners, owner for staff). */
  accountId: string
  /** Linked staff_member.id for staff accounts, else null. */
  staffMemberId: number | null
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/** Raw authenticated user id (the logged-in account's own id). */
export async function getUserId() {
  const session = await getSession()
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/**
 * Resolves the logged-in user along with their app role and the `accountId`
 * (the owner whose data they operate on). Staff accounts read the owner's data.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getSession()
  if (!session?.user) throw new Error("Unauthorized")

  const [row] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)

  // Deactivated accounts are treated as logged out. Revoke any lingering
  // sessions so they can't keep operating on a cached cookie.
  if (row?.disabledAt) {
    const ctx = await auth.$context
    await ctx.internalAdapter.deleteUserSessions(session.user.id).catch(() => {})
    throw new Error("Unauthorized")
  }

  const appRole: AppRole = row?.appRole === "staff" ? "staff" : "owner"

  // Staff always read their owner's data. Owners read the data of their
  // currently-active business (one login can own several businesses).
  const accountId =
    appRole === "staff" && row?.ownerId
      ? row.ownerId
      : await resolveActiveBusinessScope(session.user.id)

  return {
    id: session.user.id,
    name: row?.name ?? session.user.name,
    email: row?.email ?? session.user.email,
    appRole,
    accountId,
    staffMemberId: row?.staffMemberId ?? null,
  }
}

/**
 * Resolves the active business data-scope for an owner login. Returns the
 * `scopeId` of the business selected via cookie, falling back to the first
 * business. When the owner has no business rows yet (legacy accounts), the
 * scope is simply their own login id so existing data stays accessible.
 */
export async function resolveActiveBusinessScope(loginId: string): Promise<string> {
  const businesses = await db
    .select({ scopeId: business.scopeId })
    .from(business)
    .where(eq(business.ownerUserId, loginId))
    .orderBy(asc(business.id))

  if (businesses.length === 0) return loginId

  const cookieStore = await cookies()
  const wanted = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value
  const match = businesses.find((b) => b.scopeId === wanted)
  return (match ?? businesses[0]).scopeId
}

/**
 * The data-scope id for queries. Owners use their own id; staff use their
 * owner's id so they transparently read the business's data.
 */
export async function getAccountId(): Promise<string> {
  const me = await getCurrentUser()
  return me.accountId
}

/** Throws when the current user is not an owner. Use to guard owner-only actions. */
export async function requireOwner(): Promise<CurrentUser> {
  const me = await getCurrentUser()
  if (me.appRole !== "owner") throw new Error("Forbidden")
  return me
}

/**
 * Guard for owner-only pages. Staff are redirected to their schedule rather
 * than seeing an error. Returns the current user for owners.
 */
export async function guardOwnerPage(): Promise<CurrentUser> {
  const me = await getCurrentUser()
  if (me.appRole !== "owner") redirect("/staff")
  return me
}

/**
 * The venue ids a staff member is assigned to. A staff login is linked to one
 * or more staff_member rows (via linkedUserId) within their owner's account;
 * each row pins a venue. Owners are not restricted, so this returns [].
 */
export async function getAssignedVenueIds(me: CurrentUser): Promise<number[]> {
  if (me.appRole !== "staff") return []
  const rows = await db
    .select({ venueId: staffMember.venueId })
    .from(staffMember)
    .where(
      and(
        eq(staffMember.userId, me.accountId),
        or(
          eq(staffMember.linkedUserId, me.id),
          me.staffMemberId != null ? eq(staffMember.id, me.staffMemberId) : undefined,
        ),
      ),
    )
  return Array.from(new Set(rows.map((r) => r.venueId)))
}

/**
 * Resolves the active venue id. For staff this is the venue of their linked
 * staff record. For owners it comes from the cookie, falling back to their
 * first venue. Returns null when there are no venues.
 */
export async function getActiveVenueId(accountId: string): Promise<number | null> {
  const me = await getCurrentUser().catch(() => null)

  // Staff can only see the venues they're assigned to (linked staff records).
  // They may switch between them; the cookie is honored when it points to an
  // assigned venue, otherwise we fall back to their pinned staff-record venue.
  if (me?.appRole === "staff") {
    const assigned = await getAssignedVenueIds(me)
    if (assigned.length > 0) {
      const cookieStore = await cookies()
      const raw = cookieStore.get(ACTIVE_VENUE_COOKIE)?.value
      const wanted = raw ? Number.parseInt(raw, 10) : Number.NaN
      if (assigned.includes(wanted)) return wanted

      if (me.staffMemberId != null) {
        const [sm] = await db
          .select({ venueId: staffMember.venueId })
          .from(staffMember)
          .where(eq(staffMember.id, me.staffMemberId))
          .limit(1)
        if (sm && assigned.includes(sm.venueId)) return sm.venueId
      }
      return assigned[0]
    }
  }

  // Guarantee the owner's demo data exists before resolving a venue. Pages render
  // in parallel with the layout, so relying on the layout alone to seed creates a
  // race where a page can query venues before seeding finishes. ensureSeeded is
  // idempotent (it no-ops once a venue exists), so this is cheap on later calls.
  if (me?.appRole === "owner") {
    await ensureSeeded(me.id, me.name, me.email)
  }

  const venues = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.userId, accountId))
    .orderBy(asc(venue.id))

  if (venues.length === 0) return null

  const cookieStore = await cookies()
  const raw = cookieStore.get(ACTIVE_VENUE_COOKIE)?.value
  const wanted = raw ? Number.parseInt(raw, 10) : Number.NaN
  const match = venues.find((v) => v.id === wanted)
  return match ? match.id : venues[0].id
}
