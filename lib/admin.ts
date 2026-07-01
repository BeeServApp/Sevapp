import "server-only"

import { getCurrentUser } from "@/lib/session"

/** Emails that are always treated as super admins, regardless of env config. */
const HARDCODED_SUPER_ADMINS = ["bradd@thebeesgroup.co.uk"]

/**
 * The set of allowed super-admin emails.
 * Combines the always-on list above with SUPER_ADMIN_EMAIL, which may be a
 * single email or a comma-separated list.
 */
export function superAdminEmails(): string[] {
  const fromEnv = (process.env.SUPER_ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
  return Array.from(new Set([...HARDCODED_SUPER_ADMINS, ...fromEnv]))
}

/** True when the given email is one of the configured super admins. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return superAdminEmails().includes(email.trim().toLowerCase())
}

/** Returns the current user if they are the super admin, otherwise null. */
export async function getSuperAdmin() {
  try {
    const me = await getCurrentUser()
    return isSuperAdminEmail(me.email) ? me : null
  } catch {
    return null
  }
}

/** Throws unless the current user is the super admin. */
export async function requireSuperAdmin() {
  const admin = await getSuperAdmin()
  if (!admin) throw new Error("Not authorized")
  return admin
}
