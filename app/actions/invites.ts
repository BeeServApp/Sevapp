"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { company, staffInvite, staffMember, user, venue } from "@/lib/db/schema"
import { getActiveVenueId, requireOwner } from "@/lib/session"
import { emitChange } from "@/lib/realtime"
import { and, eq } from "drizzle-orm"
import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"

/** Owner action: create (or refresh) an invite link for a staff member. */
export async function createStaffInvite(staffMemberId: number, email?: string) {
  const me = await requireOwner()
  const venueId = await getActiveVenueId(me.accountId)
  if (venueId == null) throw new Error("No active venue")

  // Confirm the staff member belongs to this owner.
  const [sm] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  if (!sm) throw new Error("Staff member not found")

  const trimmedEmail = email?.trim() || sm.email || null
  if (trimmedEmail && trimmedEmail !== sm.email) {
    await db.update(staffMember).set({ email: trimmedEmail }).where(eq(staffMember.id, staffMemberId))
  }

  // Reuse an existing pending invite, otherwise create one.
  const existing = await db
    .select()
    .from(staffInvite)
    .where(
      and(
        eq(staffInvite.userId, me.accountId),
        eq(staffInvite.staffMemberId, staffMemberId),
        eq(staffInvite.status, "pending"),
      ),
    )
    .limit(1)

  let token: string
  if (existing.length > 0) {
    token = existing[0].token
    if (trimmedEmail && trimmedEmail !== existing[0].email) {
      await db.update(staffInvite).set({ email: trimmedEmail }).where(eq(staffInvite.id, existing[0].id))
    }
  } else {
    token = randomBytes(18).toString("base64url")
    await db.insert(staffInvite).values({
      userId: me.accountId,
      venueId,
      staffMemberId,
      token,
      email: trimmedEmail,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14 days
    })
  }

  revalidatePath("/staff")
  return { token }
}

export async function revokeStaffInvite(staffMemberId: number) {
  const me = await requireOwner()
  await db
    .update(staffInvite)
    .set({ status: "revoked" })
    .where(
      and(
        eq(staffInvite.userId, me.accountId),
        eq(staffInvite.staffMemberId, staffMemberId),
        eq(staffInvite.status, "pending"),
      ),
    )
  revalidatePath("/staff")
}

export interface InviteDetails {
  valid: boolean
  reason?: string
  staffName?: string
  roleLabel?: string
  venueName?: string
  companyName?: string
  email?: string | null
}

/** Public: look up an invite by token for the join page. */
export async function getInviteByToken(token: string): Promise<InviteDetails> {
  const [invite] = await db.select().from(staffInvite).where(eq(staffInvite.token, token)).limit(1)
  if (!invite) return { valid: false, reason: "not_found" }
  if (invite.status !== "pending") return { valid: false, reason: "used" }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return { valid: false, reason: "expired" }

  const [sm] = await db.select().from(staffMember).where(eq(staffMember.id, invite.staffMemberId)).limit(1)
  const [v] = await db.select().from(venue).where(eq(venue.id, invite.venueId)).limit(1)
  const [co] = await db.select().from(company).where(eq(company.userId, invite.userId)).limit(1)

  return {
    valid: true,
    staffName: sm?.name,
    roleLabel: sm?.role,
    venueName: v?.name,
    companyName: co?.name || v?.name,
    email: invite.email,
  }
}

/**
 * Public: accept an invite by creating a staff login bound to the rota record.
 * Creates a Better Auth account (auto signs in) then links it to the owner.
 */
export async function acceptStaffInvite(data: {
  token: string
  name: string
  email: string
  password: string
}) {
  const [invite] = await db.select().from(staffInvite).where(eq(staffInvite.token, data.token)).limit(1)
  if (!invite || invite.status !== "pending") {
    return { ok: false as const, error: "This invite is no longer valid." }
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "This invite has expired." }
  }

  const email = data.email.trim().toLowerCase()
  const name = data.name.trim()
  if (!name || !email || data.password.length < 8) {
    return { ok: false as const, error: "Enter your name, email and a password (8+ characters)." }
  }

  // Create the auth user (this also signs them in via autoSignIn).
  try {
    await auth.api.signUpEmail({ body: { email, password: data.password, name } })
  } catch (err) {
    const message = (err as Error).message || "Could not create your account."
    return { ok: false as const, error: message.includes("exist") ? "An account with this email already exists. Ask your manager to link it." : message }
  }

  // Find the freshly created user and link it to the owner + staff record.
  const [created] = await db.select().from(user).where(eq(user.email, email)).limit(1)
  if (!created) return { ok: false as const, error: "Account created but could not be linked. Contact your manager." }

  await db
    .update(user)
    .set({ appRole: "staff", ownerId: invite.userId, staffMemberId: invite.staffMemberId })
    .where(eq(user.id, created.id))

  await db
    .update(staffMember)
    .set({ linkedUserId: created.id, email })
    .where(eq(staffMember.id, invite.staffMemberId))

  await db.update(staffInvite).set({ status: "accepted" }).where(eq(staffInvite.id, invite.id))

  await emitChange(invite.userId, "all")

  return { ok: true as const }
}
