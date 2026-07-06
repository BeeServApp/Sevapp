"use server"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { getUserId } from "@/lib/session"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function updateProfile(data: { name: string }) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Name is required")

  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, userId))

  revalidatePath("/", "layout")
}

export interface SecurityState {
  email: string
  emailVerified: boolean
  twoFactorEnabled: boolean
}

/** Current user's email-verification and 2FA status for the settings page. */
export async function getSecurityState(): Promise<SecurityState> {
  const userId = await getUserId()
  const [row] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  return {
    email: row?.email ?? "",
    emailVerified: row?.emailVerified ?? false,
    twoFactorEnabled: row?.twoFactorEnabled ?? false,
  }
}

/** Resend the email-verification link to the current user. */
export async function resendVerification(): Promise<{ ok: boolean }> {
  const userId = await getUserId()
  const [row] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!row?.email) return { ok: false }
  try {
    await auth.api.sendVerificationEmail({ body: { email: row.email } })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
