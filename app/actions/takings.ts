"use server"

import { db } from "@/lib/db"
import { takings } from "@/lib/db/schema"
import { getAccountId as getUserId } from "@/lib/session"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getTakings(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(takings)
    .where(and(eq(takings.userId, userId), eq(takings.venueId, venueId)))
    .orderBy(desc(takings.dateISO))
}

export async function createTakings(data: {
  venueId: number
  dateISO: string
  wetPence: number
  foodPence: number
  eventsPence: number
  retailPence: number
}) {
  const userId = await getUserId()
  // One entry per day: replace any existing row for the same date, but carry
  // over any Square-synced card sales so manual edits never wipe them.
  const [existing] = await db
    .select({ squarePence: takings.squarePence })
    .from(takings)
    .where(
      and(
        eq(takings.userId, userId),
        eq(takings.venueId, data.venueId),
        eq(takings.dateISO, data.dateISO),
      ),
    )
    .limit(1)
  await db
    .delete(takings)
    .where(
      and(
        eq(takings.userId, userId),
        eq(takings.venueId, data.venueId),
        eq(takings.dateISO, data.dateISO),
      ),
    )
  const [created] = await db
    .insert(takings)
    .values({ userId, ...data, squarePence: existing?.squarePence ?? 0 })
    .returning()
  revalidatePath("/financials")
  revalidatePath("/dashboard")
  return created
}

export async function deleteTakings(id: number) {
  const userId = await getUserId()
  await db.delete(takings).where(and(eq(takings.id, id), eq(takings.userId, userId)))
  revalidatePath("/financials")
  revalidatePath("/dashboard")
}
