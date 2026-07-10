import "server-only"

import { db } from "@/lib/db"
import { kioskDevice, venue } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { cookies } from "next/headers"

// The kiosk is not a logged-in Better Auth user. Instead an iPad is paired once
// and identified by an opaque device token kept in this httpOnly cookie.
export const KIOSK_COOKIE = "beeserv_kiosk_token"

export interface KioskContext {
  deviceId: number
  token: string
  /** The owning account (venue.userId) whose data the kiosk reads/writes. */
  accountId: string
  venueId: number
  venueName: string
  /** Whether an admin PIN is configured (required to exit lock / open manager areas). */
  hasAdminPin: boolean
  spotifyPlaylistUrl: string | null
}

/** Resolve the paired venue context from the device cookie, or null if unpaired. */
export async function getKioskContext(): Promise<KioskContext | null> {
  const store = await cookies()
  const token = store.get(KIOSK_COOKIE)?.value
  if (!token) return null

  const [device] = await db.select().from(kioskDevice).where(eq(kioskDevice.token, token)).limit(1)
  if (!device) return null

  const [v] = await db
    .select()
    .from(venue)
    .where(and(eq(venue.id, device.venueId), eq(venue.userId, device.userId)))
    .limit(1)
  if (!v) return null

  return {
    deviceId: device.id,
    token: device.token,
    accountId: device.userId,
    venueId: device.venueId,
    venueName: v.name,
    hasAdminPin: !!v.kioskAdminPin,
    spotifyPlaylistUrl: v.spotifyPlaylistUrl ?? null,
  }
}

/** Same as getKioskContext but throws when the device isn't paired. */
export async function requireKioskContext(): Promise<KioskContext> {
  const ctx = await getKioskContext()
  if (!ctx) throw new Error("This device is not paired to a venue.")
  return ctx
}
