import "server-only"

import { getCurrentUser } from "@/lib/session"

/** The designated super-admin email, configured via env. */
export function superAdminEmail(): string | null {
  const raw = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
  return raw && raw.length > 0 ? raw : null
}

/** True when the given email is the configured super admin. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const admin = superAdminEmail()
  if (!admin || !email) return false
  return email.trim().toLowerCase() === admin
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
