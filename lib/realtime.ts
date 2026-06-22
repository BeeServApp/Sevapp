import "server-only"

import { db } from "@/lib/db"
import { accountEvent } from "@/lib/db/schema"
import { and, desc, eq, gt } from "drizzle-orm"

/**
 * Real-time is implemented as a lightweight change feed: writers append a row to
 * `account_event`, and the SSE endpoint (app/api/realtime) watches the latest id
 * per account and notifies connected clients. Clients then revalidate their data.
 *
 * This is reliable on serverless because the stream only does short polled reads
 * of a single indexed table rather than holding open a database LISTEN/NOTIFY.
 */

export type RealtimeChannel = "rota" | "tasks" | "notifications" | "all"

/** Append a change event for an account so connected clients refresh. */
export async function emitChange(accountId: string, channel: RealtimeChannel = "all") {
  try {
    await db.insert(accountEvent).values({ accountId, channel })
  } catch (err) {
    console.log("[v0] emitChange failed:", (err as Error).message)
  }
}

/** Latest event id for an account, or 0 when there are none yet. */
export async function getLatestEventId(accountId: string): Promise<number> {
  const [row] = await db
    .select({ id: accountEvent.id })
    .from(accountEvent)
    .where(eq(accountEvent.accountId, accountId))
    .orderBy(desc(accountEvent.id))
    .limit(1)
  return row?.id ?? 0
}

/** Channels with new events for an account since a given id. */
export async function getChannelsSince(accountId: string, sinceId: number) {
  const rows = await db
    .select({ id: accountEvent.id, channel: accountEvent.channel })
    .from(accountEvent)
    .where(and(eq(accountEvent.accountId, accountId), gt(accountEvent.id, sinceId)))
    .orderBy(desc(accountEvent.id))
    .limit(50)
  return rows
}
