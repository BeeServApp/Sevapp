"use server"

import { db } from "@/lib/db"
import { scheduledPublish } from "@/lib/db/schema"
import { requireOwner, getAccountId } from "@/lib/session"
import { publishRotaCore } from "@/app/actions/staff"
import { and, asc, eq, lte } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface ScheduledPublishInfo {
  id: number
  venueId: number
  weekStart: string
  publishAt: string
  status: string
}

/**
 * Owner action: schedule a venue's rota for a given week to auto-publish at a
 * future instant. Replaces any existing pending job for the same venue/week so
 * the owner can freely re-pick the time.
 */
export async function scheduleRotaPublish(venueId: number, weekStart: string, publishAtISO: string) {
  const me = await requireOwner()
  const publishAt = new Date(publishAtISO)
  if (Number.isNaN(publishAt.getTime())) throw new Error("Invalid publish time")
  if (publishAt.getTime() <= Date.now()) throw new Error("Publish time must be in the future")

  // Clear any existing pending job for this venue/week, then insert the new one.
  await db
    .update(scheduledPublish)
    .set({ status: "cancelled", processedAt: new Date() })
    .where(
      and(
        eq(scheduledPublish.userId, me.accountId),
        eq(scheduledPublish.venueId, venueId),
        eq(scheduledPublish.weekStart, weekStart),
        eq(scheduledPublish.status, "pending"),
      ),
    )

  const [created] = await db
    .insert(scheduledPublish)
    .values({ userId: me.accountId, venueId, weekStart, publishAt, status: "pending" })
    .returning()

  revalidatePath("/staff")
  return {
    id: created.id,
    venueId: created.venueId,
    weekStart: created.weekStart,
    publishAt: created.publishAt.toISOString(),
    status: created.status,
  } satisfies ScheduledPublishInfo
}

/** Owner action: cancel the pending scheduled publish for a venue/week, if any. */
export async function cancelScheduledPublish(venueId: number, weekStart: string) {
  const me = await requireOwner()
  await db
    .update(scheduledPublish)
    .set({ status: "cancelled", processedAt: new Date() })
    .where(
      and(
        eq(scheduledPublish.userId, me.accountId),
        eq(scheduledPublish.venueId, venueId),
        eq(scheduledPublish.weekStart, weekStart),
        eq(scheduledPublish.status, "pending"),
      ),
    )
  revalidatePath("/staff")
}

/** Read the pending scheduled publish for a venue/week (for the rota toolbar). */
export async function getScheduledPublish(
  venueId: number,
  weekStart: string,
): Promise<ScheduledPublishInfo | null> {
  const accountId = await getAccountId()
  const [row] = await db
    .select()
    .from(scheduledPublish)
    .where(
      and(
        eq(scheduledPublish.userId, accountId),
        eq(scheduledPublish.venueId, venueId),
        eq(scheduledPublish.weekStart, weekStart),
        eq(scheduledPublish.status, "pending"),
      ),
    )
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    venueId: row.venueId,
    weekStart: row.weekStart,
    publishAt: row.publishAt.toISOString(),
    status: row.status,
  }
}

/**
 * Session-less: publish every scheduled rota whose time has arrived. Used by the
 * cron route and by a page-load fallback. Idempotent — each due job is flipped to
 * "done" so it only runs once, even if invoked concurrently.
 */
export async function runDueScheduledPublishes(): Promise<{ processed: number; published: number }> {
  const now = new Date()
  const due = await db
    .select()
    .from(scheduledPublish)
    .where(and(eq(scheduledPublish.status, "pending"), lte(scheduledPublish.publishAt, now)))
    .orderBy(asc(scheduledPublish.publishAt))

  let processed = 0
  let published = 0
  for (const job of due) {
    // Claim the job atomically: only the updater that flips pending→done proceeds.
    const claimed = await db
      .update(scheduledPublish)
      .set({ status: "done", processedAt: new Date() })
      .where(and(eq(scheduledPublish.id, job.id), eq(scheduledPublish.status, "pending")))
      .returning()
    if (claimed.length === 0) continue

    const res = await publishRotaCore(job.userId, job.venueId, job.weekStart)
    processed++
    published += res.published
  }
  return { processed, published }
}
