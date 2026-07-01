"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { business, company, user, venue } from "@/lib/db/schema"
import * as schema from "@/lib/db/schema"
import { requireSuperAdmin } from "@/lib/admin"
import { isSuperAdminEmail } from "@/lib/admin"
import { getTier } from "@/lib/pricing"
import { asc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface AdminAccount {
  id: string
  name: string
  email: string
  appRole: string
  createdAt: string
  businessCount: number
  venueCount: number
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  mrrPence: number
  /** ISO timestamp when the account was deactivated, or null if active. */
  disabledAt: string | null
}

export interface AdminMetrics {
  totalCustomers: number
  totalStaffAccounts: number
  activeSubscriptions: number
  trialingCount: number
  totalVenues: number
  /** Monthly recurring revenue from currently active subscriptions, in pence. */
  mrrPence: number
  /** Potential monthly revenue from trials that have not yet converted, in pence. */
  trialPipelinePence: number
  planBreakdown: { plan: string; customers: number; mrrPence: number }[]
}

/** Resolves the per-location quantity we bill an account for. */
function billedQuantity(subscriptionQuantity: number | null, venueCount: number): number {
  if (typeof subscriptionQuantity === "number" && subscriptionQuantity > 0) {
    return subscriptionQuantity
  }
  return Math.max(venueCount, 1)
}

/** Monthly value of a subscription row, in pence. */
function monthlyValuePence(plan: string | null, quantity: number): number {
  const tier = plan ? getTier(plan) : undefined
  if (!tier) return 0
  return tier.pricePerLocationPence * quantity
}

/**
 * Builds a map of scopeId -> venue count so we can attribute venues (and
 * therefore per-location pricing) to the right owner. Venues are keyed by
 * `userId`, which equals a business's `scopeId`.
 */
async function venueCountsByScope(): Promise<Map<string, number>> {
  const venues = await db.select({ userId: venue.userId }).from(venue)
  const counts = new Map<string, number>()
  for (const v of venues) {
    counts.set(v.userId, (counts.get(v.userId) ?? 0) + 1)
  }
  return counts
}

/**
 * Maps each owner login to the set of data scopes (business scopeIds) they
 * control. A login always owns at least its default scope (its own user id).
 */
async function scopesByOwner(): Promise<Map<string, string[]>> {
  const businesses = await db
    .select({ ownerUserId: business.ownerUserId, scopeId: business.scopeId })
    .from(business)
  const map = new Map<string, string[]>()
  for (const b of businesses) {
    const list = map.get(b.ownerUserId) ?? []
    list.push(b.scopeId)
    map.set(b.ownerUserId, list)
  }
  return map
}

/** Lists every account for the super-admin console with revenue attribution. */
export async function listAccounts(): Promise<AdminAccount[]> {
  await requireSuperAdmin()

  const users = await db.select().from(user).orderBy(asc(user.createdAt))
  const companies = await db.select().from(company)
  const venueCounts = await venueCountsByScope()
  const ownerScopes = await scopesByOwner()

  // A company row is keyed by the active business scope; for the owner's default
  // business that scope equals their user id, so this lookup covers most owners.
  const companyByScope = new Map(companies.map((c) => [c.userId, c]))

  return users.map((u) => {
    const scopes = ownerScopes.get(u.id) ?? []
    // Always include the login's own id as its default scope.
    const allScopes = Array.from(new Set([u.id, ...scopes]))
    const venueCount = allScopes.reduce((sum, s) => sum + (venueCounts.get(s) ?? 0), 0)

    const c = companyByScope.get(u.id)
    const status = c?.subscriptionStatus ?? null
    const plan = c?.subscriptionPlan ?? null
    const qty = billedQuantity(c?.subscriptionQuantity ?? null, venueCount)
    const mrrPence = status === "active" ? monthlyValuePence(plan, qty) : 0

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      appRole: u.appRole,
      createdAt: u.createdAt.toISOString(),
      businessCount: scopes.length || (u.appRole === "owner" ? 1 : 0),
      venueCount,
      subscriptionStatus: status,
      subscriptionPlan: plan,
      mrrPence,
      disabledAt: u.disabledAt ? u.disabledAt.toISOString() : null,
    }
  })
}

/** Aggregated business metrics for the admin overview. */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  await requireSuperAdmin()

  const accounts = await listAccounts()
  const owners = accounts.filter((a) => a.appRole === "owner")

  let activeSubscriptions = 0
  let trialingCount = 0
  let mrrPence = 0
  let trialPipelinePence = 0
  let totalVenues = 0
  const planMap = new Map<string, { customers: number; mrrPence: number }>()

  for (const a of owners) {
    totalVenues += a.venueCount
    if (a.subscriptionStatus === "active") {
      activeSubscriptions += 1
      mrrPence += a.mrrPence
      const plan = a.subscriptionPlan ?? "unknown"
      const entry = planMap.get(plan) ?? { customers: 0, mrrPence: 0 }
      entry.customers += 1
      entry.mrrPence += a.mrrPence
      planMap.set(plan, entry)
    } else if (a.subscriptionStatus === "trialing") {
      trialingCount += 1
      const qty = Math.max(a.venueCount, 1)
      trialPipelinePence += monthlyValuePence(a.subscriptionPlan, qty)
    }
  }

  return {
    totalCustomers: owners.length,
    totalStaffAccounts: accounts.length - owners.length,
    activeSubscriptions,
    trialingCount,
    totalVenues,
    mrrPence,
    trialPipelinePence,
    planBreakdown: Array.from(planMap.entries()).map(([plan, v]) => ({
      plan,
      customers: v.customers,
      mrrPence: v.mrrPence,
    })),
  }
}

export interface AdminVenue {
  id: number
  name: string
  type: string
  status: string
  address: string | null
  city: string | null
  postcode: string | null
  phone: string | null
  email: string | null
  managerName: string | null
}

export interface AdminAccountDetail {
  id: string
  name: string
  email: string
  appRole: string
  createdAt: string
  disabledAt: string | null
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  subscriptionQuantity: number | null
  companyName: string | null
  venues: AdminVenue[]
}

/** All scopes (default + businesses) an owner login controls. */
async function ownerScopeIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ scopeId: business.scopeId })
    .from(business)
    .where(eq(business.ownerUserId, userId))
  return Array.from(new Set([userId, ...rows.map((r) => r.scopeId)]))
}

/** Full detail for one customer account, including its venues. */
export async function getAccountDetail(userId: string): Promise<AdminAccountDetail> {
  await requireSuperAdmin()

  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!target) throw new Error("Account not found")

  const [c] = await db.select().from(company).where(eq(company.userId, userId)).limit(1)

  const scopes = await ownerScopeIds(userId)
  const venues =
    scopes.length > 0
      ? await db.select().from(venue).where(inArray(venue.userId, scopes)).orderBy(asc(venue.id))
      : []

  return {
    id: target.id,
    name: target.name,
    email: target.email,
    appRole: target.appRole,
    createdAt: target.createdAt.toISOString(),
    disabledAt: target.disabledAt ? target.disabledAt.toISOString() : null,
    subscriptionStatus: c?.subscriptionStatus ?? null,
    subscriptionPlan: c?.subscriptionPlan ?? null,
    subscriptionQuantity: c?.subscriptionQuantity ?? null,
    companyName: c?.name ?? null,
    venues: venues.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      status: v.status,
      address: v.address,
      city: v.city,
      postcode: v.postcode,
      phone: v.phone,
      email: v.email,
      managerName: v.managerName,
    })),
  }
}

/** Updates a customer's profile (name + email). Super admin only. */
export async function adminUpdateAccount(formData: FormData): Promise<{ ok: true }> {
  await requireSuperAdmin()

  const userId = String(formData.get("userId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()

  if (!userId) throw new Error("Missing account")
  if (!name) throw new Error("Name is required")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required")

  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!target) throw new Error("Account not found")

  // Guard against assigning an email already used by a different account.
  if (email !== target.email.toLowerCase()) {
    const [clash] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
    if (clash && clash.id !== userId) throw new Error("That email is already in use")
  }

  await db
    .update(user)
    .set({ name, email, updatedAt: new Date() })
    .where(eq(user.id, userId))

  revalidatePath("/admin")
  return { ok: true }
}

/** Updates a customer's subscription plan/status. Super admin only. */
export async function adminUpdateSubscription(formData: FormData): Promise<{ ok: true }> {
  await requireSuperAdmin()

  const userId = String(formData.get("userId") ?? "")
  const plan = String(formData.get("plan") ?? "").trim() || null
  const status = String(formData.get("status") ?? "").trim() || "none"

  if (!userId) throw new Error("Missing account")

  const [existing] = await db.select().from(company).where(eq(company.userId, userId)).limit(1)
  if (existing) {
    await db
      .update(company)
      .set({ subscriptionPlan: plan, subscriptionStatus: status, updatedAt: new Date() })
      .where(eq(company.userId, userId))
  } else {
    await db.insert(company).values({
      userId,
      subscriptionPlan: plan,
      subscriptionStatus: status,
    })
  }

  revalidatePath("/admin")
  return { ok: true }
}

/** Updates a venue on behalf of a customer. Verifies scope ownership. */
export async function adminUpdateVenue(formData: FormData): Promise<{ ok: true }> {
  await requireSuperAdmin()

  const userId = String(formData.get("userId") ?? "")
  const venueId = Number(formData.get("venueId") ?? "")
  const name = String(formData.get("name") ?? "").trim()

  if (!userId) throw new Error("Missing account")
  if (!Number.isInteger(venueId)) throw new Error("Missing venue")
  if (!name) throw new Error("Venue name is required")

  // Make sure the venue really belongs to one of this owner's scopes.
  const scopes = await ownerScopeIds(userId)
  const [existing] = await db.select().from(venue).where(eq(venue.id, venueId)).limit(1)
  if (!existing || !scopes.includes(existing.userId)) {
    throw new Error("Venue not found for this account")
  }

  await db
    .update(venue)
    .set({
      name,
      type: String(formData.get("type") ?? existing.type) || "Pub",
      status: String(formData.get("status") ?? existing.status) || "Active",
      address: (String(formData.get("address") ?? "").trim() || null) as string | null,
      city: (String(formData.get("city") ?? "").trim() || null) as string | null,
      postcode: (String(formData.get("postcode") ?? "").trim() || null) as string | null,
      phone: (String(formData.get("phone") ?? "").trim() || null) as string | null,
      email: (String(formData.get("email") ?? "").trim() || null) as string | null,
      managerName: (String(formData.get("managerName") ?? "").trim() || null) as string | null,
    })
    .where(eq(venue.id, venueId))

  revalidatePath("/admin")
  return { ok: true }
}

/**
 * Sets a new password for any account. Only the super admin may call this.
 * Uses Better Auth's hashing context and revokes the target's sessions.
 */
export async function adminSetPassword(formData: FormData): Promise<{ ok: true }> {
  const admin = await requireSuperAdmin()

  const userId = String(formData.get("userId") ?? "")
  const newPassword = String(formData.get("newPassword") ?? "")

  if (!userId) throw new Error("Missing account")
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters")

  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!target) throw new Error("Account not found")

  // Guard: don't let the admin lock themselves out via this tool by accident.
  if (target.id === admin.id) {
    throw new Error("Use account settings to change your own password")
  }

  const ctx = await auth.$context
  const hashed = await ctx.password.hash(newPassword)

  const accounts = await ctx.internalAdapter.findAccounts(userId)
  const credential = accounts.find((a) => a.providerId === "credential")

  if (credential) {
    await ctx.internalAdapter.updatePassword(userId, hashed)
  } else {
    await ctx.internalAdapter.createAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: hashed,
    })
  }

  // Force re-login everywhere with the new credentials.
  await ctx.internalAdapter.deleteUserSessions(userId)

  revalidatePath("/admin")
  return { ok: true }
}

/**
 * Deactivates an account: marks it disabled and revokes all its sessions so
 * the user is logged out immediately and blocked from signing back in.
 */
export async function adminDeactivateAccount(formData: FormData): Promise<{ ok: true }> {
  const admin = await requireSuperAdmin()

  const userId = String(formData.get("userId") ?? "")
  if (!userId) throw new Error("Missing account")

  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!target) throw new Error("Account not found")
  if (target.id === admin.id) throw new Error("You can't deactivate your own account")
  if (isSuperAdminEmail(target.email)) throw new Error("You can't deactivate a super admin account")

  await db.update(user).set({ disabledAt: new Date(), updatedAt: new Date() }).where(eq(user.id, userId))

  // Immediately log them out everywhere.
  const ctx = await auth.$context
  await ctx.internalAdapter.deleteUserSessions(userId)

  revalidatePath("/admin")
  return { ok: true }
}

/** Reactivates a previously deactivated account so it can sign in again. */
export async function adminReactivateAccount(formData: FormData): Promise<{ ok: true }> {
  await requireSuperAdmin()

  const userId = String(formData.get("userId") ?? "")
  if (!userId) throw new Error("Missing account")

  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!target) throw new Error("Account not found")

  await db.update(user).set({ disabledAt: null, updatedAt: new Date() }).where(eq(user.id, userId))

  revalidatePath("/admin")
  return { ok: true }
}

// Every app table is scoped by a `userId` column that equals a business scope.
// Deleting an account wipes all rows across these tables for its scopes.
const USER_SCOPED_TABLES = [
  schema.venue,
  schema.company,
  schema.member,
  schema.asset,
  schema.order,
  schema.supplier,
  schema.maintenance,
  schema.venueEvent,
  schema.calendarEvent,
  schema.task,
  schema.complianceCheck,
  schema.certificate,
  schema.document,
  schema.staffMember,
  schema.rotaShift,
  schema.scheduledPublish,
  schema.staffInvite,
  schema.notification,
  schema.leaveRequest,
  schema.clockEvent,
  schema.schedulingSettings,
  schema.availability,
  schema.shiftSwap,
  schema.timecard,
  schema.tipEntry,
  schema.shiftPattern,
  schema.rotaTemplate,
  schema.rotaTemplateShift,
  schema.shiftTask,
  schema.taskCheck,
  schema.taskCheckItem,
  schema.correctiveAction,
  schema.meeting,
  schema.meetingAction,
  schema.meterReading,
  schema.opsDocument,
  schema.safetyRecord,
  schema.riskAssessment,
  schema.riskHazard,
  schema.staffPolicy,
  schema.policyAck,
  schema.dailyChecklist,
  schema.dailyChecklistRun,
  schema.audit,
  schema.foodCheck,
  schema.foodCheckLog,
  schema.foodPolicy,
  schema.expense,
  schema.takings,
  schema.gamingMachine,
  schema.gamingEntry,
  schema.budget,
  schema.onboarding,
  schema.hrDocument,
  schema.onboardingTask,
] as const

// Tables keyed by `accountId` (the login) rather than a data scope.
const ACCOUNT_SCOPED_TABLES = [schema.squareConnection, schema.accountEvent] as const

/**
 * Permanently deletes a customer/member account and ALL of their data across
 * every scope they own (venues, staff, schedules, compliance, billing, etc.),
 * plus any staff sub-logins linked to them. This is irreversible.
 */
export async function adminDeleteAccount(formData: FormData): Promise<{ ok: true }> {
  const admin = await requireSuperAdmin()

  const userId = String(formData.get("userId") ?? "")
  if (!userId) throw new Error("Missing account")

  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!target) throw new Error("Account not found")
  if (target.id === admin.id) throw new Error("You can't delete your own account")
  if (isSuperAdminEmail(target.email)) throw new Error("You can't delete a super admin account")

  // All data scopes this login controls (its own id + any businesses it owns).
  const scopes = await ownerScopeIds(userId)

  // Wipe every user-scoped table for all of this account's scopes.
  for (const table of USER_SCOPED_TABLES) {
    await db.delete(table).where(inArray((table as typeof schema.venue).userId, scopes))
  }

  // Wipe integration/event tables keyed by the login id.
  for (const table of ACCOUNT_SCOPED_TABLES) {
    await db.delete(table).where(inArray((table as typeof schema.accountEvent).accountId, scopes))
  }

  // Notifications the login received directly (as a staff recipient).
  await db.delete(schema.notification).where(eq(schema.notification.recipientUserId, userId))

  // Remove business rows this login owns.
  await db.delete(business).where(eq(business.ownerUserId, userId))

  const ctx = await auth.$context

  // Find and delete any staff sub-logins linked to this owner.
  const staffLogins = await db.select({ id: user.id }).from(user).where(eq(user.ownerId, userId))
  for (const s of staffLogins) {
    await ctx.internalAdapter.deleteUserSessions(s.id).catch(() => {})
    await db.delete(user).where(eq(user.id, s.id))
  }

  // Finally revoke sessions and delete the account itself. Better Auth's
  // session/account tables cascade off the user row's foreign key.
  await ctx.internalAdapter.deleteUserSessions(userId).catch(() => {})
  await db.delete(user).where(eq(user.id, userId))

  revalidatePath("/admin")
  return { ok: true }
}
