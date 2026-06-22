"use server"

import { db } from "@/lib/db"
import { asset, member, venue } from "@/lib/db/schema"
import { ACTIVE_VENUE_COOKIE, getUserId } from "@/lib/session"
import { and, asc, eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function getVenues() {
  const userId = await getUserId()
  return db.select().from(venue).where(eq(venue.userId, userId)).orderBy(asc(venue.id))
}

export interface VenueInput {
  name: string
  type: string
  address?: string
  city?: string
  postcode?: string
  phone?: string
  email?: string
  managerName?: string
  capacity?: number | null
  floors?: number | null
  licenseNumber?: string
  licenseType?: string
  openingHours?: string | null
  status?: string
  openingDate?: string
  notes?: string
}

function normalizeVenue(data: VenueInput) {
  return {
    type: data.type || "Pub",
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    postcode: data.postcode?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    managerName: data.managerName?.trim() || null,
    capacity: typeof data.capacity === "number" && !Number.isNaN(data.capacity) ? data.capacity : null,
    floors: typeof data.floors === "number" && !Number.isNaN(data.floors) ? data.floors : null,
    licenseNumber: data.licenseNumber?.trim() || null,
    licenseType: data.licenseType?.trim() || null,
    openingHours: data.openingHours || null,
    status: data.status || "Active",
    openingDate: data.openingDate?.trim() || null,
    notes: data.notes?.trim() || null,
  }
}

export async function createVenue(data: VenueInput) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Venue name is required")

  const [created] = await db
    .insert(venue)
    .values({
      userId,
      name,
      ...normalizeVenue(data),
    })
    .returning()

  // Make the new venue active immediately.
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_VENUE_COOKIE, String(created.id), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/", "layout")
  return created
}

export async function updateVenue(id: number, data: VenueInput) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Venue name is required")

  await db
    .update(venue)
    .set({
      name,
      ...normalizeVenue(data),
    })
    .where(and(eq(venue.id, id), eq(venue.userId, userId)))
  revalidatePath("/", "layout")
}

export async function deleteVenue(id: number) {
  const userId = await getUserId()

  const owned = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.userId, userId))
  if (owned.length <= 1) throw new Error("You must keep at least one venue")

  await db.delete(asset).where(and(eq(asset.venueId, id), eq(asset.userId, userId)))
  await db.delete(member).where(and(eq(member.venueId, id), eq(member.userId, userId)))
  await db.delete(venue).where(and(eq(venue.id, id), eq(venue.userId, userId)))

  revalidatePath("/", "layout")
}

export async function setActiveVenue(id: number) {
  const userId = await getUserId()
  const [found] = await db
    .select({ id: venue.id })
    .from(venue)
    .where(and(eq(venue.id, id), eq(venue.userId, userId)))
  if (!found) throw new Error("Venue not found")

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_VENUE_COOKIE, String(id), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath("/", "layout")
}
