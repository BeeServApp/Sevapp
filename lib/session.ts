import "server-only"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { venue } from "@/lib/db/schema"
import { ensureSeeded } from "@/lib/seed"
import { asc, eq } from "drizzle-orm"
import { cookies, headers } from "next/headers"

export const ACTIVE_VENUE_COOKIE = "tapsheet_active_venue"

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getUserId() {
  const session = await getSession()
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/**
 * Resolves the active venue id for a user from the cookie, falling back to the
 * first venue they own. Returns null when the user has no venues yet.
 */
export async function getActiveVenueId(userId: string): Promise<number | null> {
  // Guarantee the user's demo data exists before resolving a venue. Pages render
  // in parallel with the layout, so relying on the layout alone to seed creates a
  // race where a page can query venues before seeding finishes. ensureSeeded is
  // idempotent (it early-returns when a venue already exists), so this is cheap.
  const session = await getSession()
  if (session?.user) {
    await ensureSeeded(session.user.id, session.user.name, session.user.email)
  }

  const venues = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.userId, userId))
    .orderBy(asc(venue.id))

  if (venues.length === 0) return null

  const cookieStore = await cookies()
  const raw = cookieStore.get(ACTIVE_VENUE_COOKIE)?.value
  const wanted = raw ? Number.parseInt(raw, 10) : Number.NaN
  const match = venues.find((v) => v.id === wanted)
  return match ? match.id : venues[0].id
}
