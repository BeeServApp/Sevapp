"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { business, company, user } from "@/lib/db/schema"
import { requireSuperAdmin } from "@/lib/admin"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface AdminAccount {
  id: string
  name: string
  email: string
  appRole: string
  createdAt: string
  businessCount: number
  subscriptionStatus: string | null
  subscriptionPlan: string | null
}

/** Lists every account for the super-admin console. */
export async function listAccounts(): Promise<AdminAccount[]> {
  await requireSuperAdmin()

  const users = await db.select().from(user).orderBy(asc(user.createdAt))
  const businesses = await db
    .select({ ownerUserId: business.ownerUserId })
    .from(business)
  const companies = await db
    .select({
      userId: company.userId,
      status: company.subscriptionStatus,
      plan: company.subscriptionPlan,
    })
    .from(company)

  const bizByOwner = new Map<string, number>()
  for (const b of businesses) {
    bizByOwner.set(b.ownerUserId, (bizByOwner.get(b.ownerUserId) ?? 0) + 1)
  }
  // A company row is keyed by the active business scope; for the owner's default
  // business that scope equals their user id, so this lookup covers most owners.
  const companyByScope = new Map(companies.map((c) => [c.userId, c]))

  return users.map((u) => {
    const c = companyByScope.get(u.id)
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      appRole: u.appRole,
      createdAt: u.createdAt.toISOString(),
      businessCount: bizByOwner.get(u.id) ?? 0,
      subscriptionStatus: c?.status ?? null,
      subscriptionPlan: c?.plan ?? null,
    }
  })
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
