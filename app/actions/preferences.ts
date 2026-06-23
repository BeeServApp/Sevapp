"use server"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface UserPreferences {
  // Sidebar module hrefs this user has personally chosen to hide.
  hiddenModules: string[]
}

function parsePreferences(raw: string | null | undefined): UserPreferences {
  if (!raw) return { hiddenModules: [] }
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    const hiddenModules = Array.isArray(parsed.hiddenModules)
      ? parsed.hiddenModules.filter((v): v is string => typeof v === "string")
      : []
    return { hiddenModules }
  } catch {
    return { hiddenModules: [] }
  }
}

/**
 * Reads the current user's personal preferences from their OWN user row. Unlike
 * company settings, this is never scoped to the owner account — staff get their
 * own private preferences that never touch the owner's configuration.
 */
export async function getMyPreferences(): Promise<UserPreferences> {
  const me = await getCurrentUser()
  const [row] = await db
    .select({ preferences: user.preferences })
    .from(user)
    .where(eq(user.id, me.id))
    .limit(1)
  return parsePreferences(row?.preferences)
}

/** Persists the current user's personally hidden sidebar modules. */
export async function updateMyHiddenModules(hiddenModules: string[]) {
  const me = await getCurrentUser()
  const clean = (hiddenModules ?? []).filter((v) => typeof v === "string")
  await db
    .update(user)
    .set({ preferences: JSON.stringify({ hiddenModules: clean }), updatedAt: new Date() })
    .where(eq(user.id, me.id))

  revalidatePath("/", "layout")
}
