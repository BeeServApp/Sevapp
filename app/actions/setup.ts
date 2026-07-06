"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { company, staffInvite, staffMember, user, venue } from "@/lib/db/schema"
import { getCurrentUser, requireOwner } from "@/lib/session"
import { ensureCompanyRow } from "@/lib/trial"
import { sendEmail } from "@/lib/email"
import { renderEmail, teamInviteTemplate } from "@/lib/email-templates"
import { and, asc, eq } from "drizzle-orm"
import { randomBytes } from "crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

/** Resolves the public origin for building absolute links inside emails. */
async function resolveOrigin(): Promise<string> {
  const envUrl =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL)
  if (envUrl) return envUrl.replace(/\/$/, "")

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : ""
}

export interface SetupState {
  name: string
  email: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  completed: boolean
  company: {
    name: string
    country: string
    currency: string
    timezone: string
    brandColor: string
  }
  firstVenue: {
    id: number
    name: string
    type: string
    city: string | null
  } | null
}

/** Snapshot used to hydrate the setup wizard. Owner-only. */
export async function getSetupState(): Promise<SetupState> {
  const me = await requireOwner()
  const [row] = await db.select().from(user).where(eq(user.id, me.id)).limit(1)
  const companyRow = await ensureCompanyRow(me.accountId)
  const [firstVenue] = await db
    .select()
    .from(venue)
    .where(eq(venue.userId, me.accountId))
    .orderBy(asc(venue.id))
    .limit(1)

  return {
    name: row?.name ?? me.name,
    email: row?.email ?? me.email,
    emailVerified: row?.emailVerified ?? false,
    twoFactorEnabled: row?.twoFactorEnabled ?? false,
    completed: row?.setupCompletedAt != null,
    company: {
      name: companyRow.name ?? "",
      country: companyRow.country ?? "United Kingdom",
      currency: companyRow.currency ?? "GBP",
      timezone: companyRow.timezone ?? "Europe/London",
      brandColor: companyRow.brandColor ?? "#16a34a",
    },
    firstVenue: firstVenue
      ? { id: firstVenue.id, name: firstVenue.name, type: firstVenue.type, city: firstVenue.city }
      : null,
  }
}

/** Step 1 — company details. */
export async function saveSetupCompany(data: {
  name: string
  country: string
  currency: string
  timezone: string
  brandColor: string
}) {
  const me = await requireOwner()
  await ensureCompanyRow(me.accountId)
  const name = data.name.trim()
  if (!name) throw new Error("Company name is required")

  await db
    .update(company)
    .set({
      name,
      country: data.country?.trim() || "United Kingdom",
      currency: data.currency || "GBP",
      timezone: data.timezone || "Europe/London",
      brandColor: data.brandColor?.trim() || "#16a34a",
      updatedAt: new Date(),
    })
    .where(eq(company.userId, me.accountId))

  revalidatePath("/", "layout")
}

/**
 * Step 2 — first venue. Updates the existing first venue when one is already
 * present (e.g. seeded), otherwise creates it. Creating a real venue here means
 * demo seeding is skipped later (ensureSeeded no-ops once a venue exists).
 */
export async function saveSetupVenue(data: {
  name: string
  type: string
  address?: string
  city?: string
  postcode?: string
}) {
  const me = await requireOwner()
  const name = data.name.trim()
  if (!name) throw new Error("Venue name is required")

  const values = {
    name,
    type: data.type || "Pub",
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    postcode: data.postcode?.trim() || null,
  }

  const [existing] = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.userId, me.accountId))
    .orderBy(asc(venue.id))
    .limit(1)

  if (existing) {
    await db.update(venue).set(values).where(and(eq(venue.id, existing.id), eq(venue.userId, me.accountId)))
  } else {
    await db.insert(venue).values({ userId: me.accountId, ...values })
  }

  revalidatePath("/", "layout")
}

export interface InviteInput {
  name: string
  email: string
  role: string
}

/**
 * Step 3 — invite teammates. Creates a staff_member record for each invitee in
 * the first venue, generates a join token, and emails them the invite link.
 * Returns the number successfully invited.
 */
export async function inviteSetupTeam(invites: InviteInput[]): Promise<{ invited: number }> {
  const me = await requireOwner()
  const cleaned = invites
    .map((i) => ({ name: i.name.trim(), email: i.email.trim().toLowerCase(), role: i.role || "Staff" }))
    .filter((i) => i.name && i.email)
  if (cleaned.length === 0) return { invited: 0 }

  const [firstVenue] = await db
    .select()
    .from(venue)
    .where(eq(venue.userId, me.accountId))
    .orderBy(asc(venue.id))
    .limit(1)
  if (!firstVenue) throw new Error("Add a venue before inviting your team")

  const [companyRow] = await db.select().from(company).where(eq(company.userId, me.accountId)).limit(1)
  const companyName = companyRow?.name || firstVenue.name
  const origin = await resolveOrigin()

  let invited = 0
  for (const invite of cleaned) {
    const [sm] = await db
      .insert(staffMember)
      .values({
        userId: me.accountId,
        venueId: firstVenue.id,
        name: invite.name,
        role: invite.role,
        email: invite.email,
        status: "Off",
      })
      .returning()

    const token = randomBytes(18).toString("base64url")
    await db.insert(staffInvite).values({
      userId: me.accountId,
      venueId: firstVenue.id,
      staffMemberId: sm.id,
      token,
      email: invite.email,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    })

    if (origin) {
      await sendEmail({
        to: invite.email,
        subject: `You're invited to join ${companyName} on TapSheet`,
        ...renderEmail(
          teamInviteTemplate({
            inviterName: me.name,
            companyName,
            roleLabel: invite.role,
            venueName: firstVenue.name,
            url: `${origin}/join/${token}`,
          }),
        ),
      })
    }
    invited++
  }

  revalidatePath("/staff")
  revalidatePath("/settings")
  return { invited }
}

/** Marks the first-run setup wizard complete so the owner is no longer routed to it. */
export async function completeSetup() {
  const me = await requireOwner()
  await db.update(user).set({ setupCompletedAt: new Date(), updatedAt: new Date() }).where(eq(user.id, me.id))
  revalidatePath("/", "layout")
}

/** Resend the email-verification link to the current user. */
export async function resendVerificationEmail(): Promise<{ ok: boolean }> {
  const me = await getCurrentUser()
  try {
    await auth.api.sendVerificationEmail({ body: { email: me.email } })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
