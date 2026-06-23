import "server-only"

import { and, eq, gte, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { takings, venue, squareConnection } from "@/lib/db/schema"
import { squareConfigured, squareFetch } from "@/lib/square"

// Materializes Square card sales into the `takings.squarePence` column so every
// revenue surface (Dashboard, Group dashboard, Financials) reflects Square
// automatically via the shared finance helpers. Safe to call during render —
// it never calls revalidatePath (the server action wrapper handles that).

interface SquarePayment {
  id: string
  status?: string
  created_at?: string
  amount_money?: { amount?: number; currency?: string }
}

export interface VenueSyncResult {
  synced: boolean
  reason?: "not_configured" | "not_connected" | "not_mapped" | "error"
  days: number
  totalPence: number
}

export interface AccountSyncResult {
  venues: number
  totalPence: number
}

/** Local YYYY-MM-DD for a Date (timezone-safe, matches lib/finance). */
function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

function countsTowardSales(p: SquarePayment) {
  const s = (p.status ?? "").toUpperCase()
  return s === "COMPLETED" || s === "APPROVED"
}

/**
 * Pulls the last `days` of Square payments for one mapped venue and writes the
 * per-day totals into that venue's takings rows (`squarePence`), creating rows
 * for days that have Square sales but no manual entry yet. Manual category
 * figures are never touched.
 */
export async function syncSquareForVenue(
  accountId: string,
  venueId: number,
  days = 35,
): Promise<VenueSyncResult> {
  if (!squareConfigured()) return { synced: false, reason: "not_configured", days: 0, totalPence: 0 }

  const [conn] = await db
    .select({ id: squareConnection.id })
    .from(squareConnection)
    .where(eq(squareConnection.accountId, accountId))
    .limit(1)
  if (!conn) return { synced: false, reason: "not_connected", days: 0, totalPence: 0 }

  const [v] = await db
    .select({ squareLocationId: venue.squareLocationId })
    .from(venue)
    .where(and(eq(venue.id, venueId), eq(venue.userId, accountId)))
    .limit(1)
  if (!v?.squareLocationId) return { synced: false, reason: "not_mapped", days: 0, totalPence: 0 }

  const now = new Date()
  const begin = new Date(now)
  begin.setHours(0, 0, 0, 0)
  begin.setDate(begin.getDate() - (days - 1))

  // Aggregate completed payments by local calendar day.
  const byDate = new Map<string, number>()
  try {
    let cursor: string | undefined
    let pages = 0
    do {
      const params = new URLSearchParams({
        location_id: v.squareLocationId,
        begin_time: begin.toISOString(),
        sort_order: "DESC",
        limit: "100",
      })
      if (cursor) params.set("cursor", cursor)
      const data = await squareFetch<{ payments?: SquarePayment[]; cursor?: string }>(
        accountId,
        `/v2/payments?${params.toString()}`,
      )
      for (const p of data.payments ?? []) {
        if (!countsTowardSales(p) || !p.created_at) continue
        const key = isoOf(new Date(p.created_at))
        byDate.set(key, (byDate.get(key) ?? 0) + (p.amount_money?.amount ?? 0))
      }
      cursor = data.cursor
      pages += 1
    } while (cursor && pages < 20)
  } catch {
    return { synced: false, reason: "error", days: 0, totalPence: 0 }
  }

  const beginISO = isoOf(begin)
  const endISO = isoOf(now)

  const existing = await db
    .select()
    .from(takings)
    .where(
      and(
        eq(takings.userId, accountId),
        eq(takings.venueId, venueId),
        gte(takings.dateISO, beginISO),
        lte(takings.dateISO, endISO),
      ),
    )
  const existingByDate = new Map(existing.map((r) => [r.dateISO, r]))

  let totalPence = 0
  let daysCount = 0

  for (const [dateISO, pence] of byDate) {
    totalPence += pence
    daysCount += 1
    const row = existingByDate.get(dateISO)
    if (row) {
      if (row.squarePence !== pence) {
        await db.update(takings).set({ squarePence: pence }).where(eq(takings.id, row.id))
      }
      existingByDate.delete(dateISO)
    } else {
      await db.insert(takings).values({ userId: accountId, venueId, dateISO, squarePence: pence })
    }
  }

  // Reset stale Square values on in-window rows that no longer have payments
  // (e.g. refunds/voids), without disturbing manual category figures.
  for (const row of existingByDate.values()) {
    if (row.squarePence !== 0) {
      await db.update(takings).set({ squarePence: 0 }).where(eq(takings.id, row.id))
    }
  }

  return { synced: true, days: daysCount, totalPence }
}

/** Syncs every mapped venue for an account (used by the group dashboard). */
export async function syncSquareForAccount(
  accountId: string,
  days = 35,
): Promise<AccountSyncResult> {
  if (!squareConfigured()) return { venues: 0, totalPence: 0 }

  const [conn] = await db
    .select({ id: squareConnection.id })
    .from(squareConnection)
    .where(eq(squareConnection.accountId, accountId))
    .limit(1)
  if (!conn) return { venues: 0, totalPence: 0 }

  const vs = await db
    .select({ id: venue.id, squareLocationId: venue.squareLocationId })
    .from(venue)
    .where(eq(venue.userId, accountId))

  let venues = 0
  let totalPence = 0
  for (const v of vs) {
    if (!v.squareLocationId) continue
    const r = await syncSquareForVenue(accountId, v.id, days)
    if (r.synced) {
      venues += 1
      totalPence += r.totalPence
    }
  }
  return { venues, totalPence }
}
