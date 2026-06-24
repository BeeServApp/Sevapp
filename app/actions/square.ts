"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { squareConnection, venue } from "@/lib/db/schema"
import { getAccountId, getActiveVenueId, requireOwner } from "@/lib/session"
import { squareConfigured, squareFetch, getRedirectUri } from "@/lib/square"
import { syncSquareForVenue, syncSquareForAccount } from "@/lib/square-sync"

// ── Types shared with the UI ────────────────────────────────────────────────

export interface SquareConnectionState {
  configured: boolean
  connected: boolean
  merchantName: string | null
  merchantId: string | null
  redirectUri: string
}

export interface SquareLocation {
  id: string
  name: string
  status: string | null
}

export interface SquareTransaction {
  id: string
  amountPence: number
  currency: string
  createdAt: string
  status: string
}

export type SquareSales =
  | { state: "not_configured" }
  | { state: "not_connected" }
  | { state: "not_mapped" }
  | {
      state: "ok"
      locationName: string | null
      todayPence: number
      periodPence: number
      todayCount: number
      periodCount: number
      currency: string
      recent: SquareTransaction[]
    }
  | { state: "error"; message: string }

// ── Connection status / disconnect ──────────────────────────────────────────

export async function getSquareConnection(): Promise<SquareConnectionState> {
  const accountId = await getAccountId()
  const [conn] = await db
    .select({ merchantId: squareConnection.merchantId, merchantName: squareConnection.merchantName })
    .from(squareConnection)
    .where(eq(squareConnection.accountId, accountId))
    .limit(1)

  return {
    configured: squareConfigured(),
    connected: Boolean(conn),
    merchantName: conn?.merchantName ?? null,
    merchantId: conn?.merchantId ?? null,
    redirectUri: getRedirectUri(),
  }
}

export async function disconnectSquare(): Promise<void> {
  await requireOwner()
  const accountId = await getAccountId()
  await db.delete(squareConnection).where(eq(squareConnection.accountId, accountId))
  // Clear any venue mappings that pointed at this Square account.
  await db
    .update(venue)
    .set({ squareLocationId: null })
    .where(eq(venue.userId, accountId))
  revalidatePath("/settings")
  revalidatePath("/dashboard")
}

// ── Locations & venue mapping ───────────────────────────────────────────────

export async function listSquareLocations(): Promise<SquareLocation[]> {
  const accountId = await getAccountId()
  try {
    const data = await squareFetch<{
      locations?: Array<{ id: string; name?: string; status?: string }>
    }>(accountId, "/v2/locations")
    return (data.locations ?? []).map((l) => ({
      id: l.id,
      name: l.name ?? l.id,
      status: l.status ?? null,
    }))
  } catch {
    return []
  }
}

export async function mapVenueToLocation(
  venueId: number,
  squareLocationId: string | null,
): Promise<void> {
  await requireOwner()
  const accountId = await getAccountId()
  await db
    .update(venue)
    .set({ squareLocationId: squareLocationId || null })
    .where(and(eq(venue.id, venueId), eq(venue.userId, accountId)))
  revalidatePath("/settings")
  revalidatePath("/dashboard")
}

// ── Sales aggregation for the dashboard ─────────────────────────────────────

interface SquarePayment {
  id: string
  status?: string
  created_at?: string
  amount_money?: { amount?: number; currency?: string }
}

export async function getSquareSales(venueId: number | null): Promise<SquareSales> {
  if (!squareConfigured()) return { state: "not_configured" }
  if (venueId == null) return { state: "not_mapped" }

  const accountId = await getAccountId()

  const [conn] = await db
    .select({ id: squareConnection.id })
    .from(squareConnection)
    .where(eq(squareConnection.accountId, accountId))
    .limit(1)
  if (!conn) return { state: "not_connected" }

  const [v] = await db
    .select({ squareLocationId: venue.squareLocationId })
    .from(venue)
    .where(and(eq(venue.id, venueId), eq(venue.userId, accountId)))
    .limit(1)
  if (!v?.squareLocationId) return { state: "not_mapped" }

  // 30-day rolling window (inclusive of today).
  const now = new Date()
  const todayBegin = new Date(now)
  todayBegin.setHours(0, 0, 0, 0)
  const periodBegin = new Date(todayBegin)
  periodBegin.setDate(periodBegin.getDate() - 29)

  try {
    const payments: SquarePayment[] = []
    let cursor: string | undefined
    let pages = 0
    do {
      const params = new URLSearchParams({
        location_id: v.squareLocationId,
        begin_time: periodBegin.toISOString(),
        sort_order: "DESC",
        limit: "100",
      })
      if (cursor) params.set("cursor", cursor)
      const data = await squareFetch<{ payments?: SquarePayment[]; cursor?: string }>(
        accountId,
        `/v2/payments?${params.toString()}`,
      )
      payments.push(...(data.payments ?? []))
      cursor = data.cursor
      pages += 1
    } while (cursor && pages < 20)

    const counts = (p: SquarePayment) => {
      const s = (p.status ?? "").toUpperCase()
      return s === "COMPLETED" || s === "APPROVED"
    }

    let todayPence = 0
    let periodPence = 0
    let todayCount = 0
    let periodCount = 0
    let currency = "GBP"
    const recent: SquareTransaction[] = []

    for (const p of payments) {
      if (!counts(p)) continue
      const amount = p.amount_money?.amount ?? 0
      currency = p.amount_money?.currency ?? currency
      const created = p.created_at ? new Date(p.created_at) : null
      periodPence += amount
      periodCount += 1
      if (created && created >= todayBegin) {
        todayPence += amount
        todayCount += 1
      }
      if (recent.length < 10) {
        recent.push({
          id: p.id,
          amountPence: amount,
          currency,
          createdAt: p.created_at ?? "",
          status: p.status ?? "UNKNOWN",
        })
      }
    }

    return {
      state: "ok",
      locationName: null,
      todayPence,
      periodPence,
      todayCount,
      periodCount,
      currency,
      recent,
    }
  } catch (err) {
    return { state: "error", message: err instanceof Error ? err.message : "Square request failed" }
  }
}

// ── Manual "Sync now" trigger ───────────────────────────────────────────────

export interface SquareSyncSummary {
  ok: boolean
  reason?: string
  days: number
  totalPence: number
  venues?: number
}

/**
 * Pulls Square card sales into the takings table on demand. `scope: "active"`
 * syncs the active venue (Dashboard / Financials); `scope: "all"` syncs every
 * mapped venue (Group dashboard). Revalidates all three surfaces.
 */
export async function syncSquareSalesNow(
  scope: "active" | "all" = "active",
): Promise<SquareSyncSummary> {
  const accountId = await getAccountId()

  let summary: SquareSyncSummary
  if (scope === "all") {
    const r = await syncSquareForAccount(accountId)
    summary = { ok: r.venues > 0, days: 0, totalPence: r.totalPence, venues: r.venues }
  } else {
    const venueId = await getActiveVenueId(accountId)
    if (venueId == null) {
      summary = { ok: false, reason: "no_venue", days: 0, totalPence: 0 }
    } else {
      const r = await syncSquareForVenue(accountId, venueId)
      summary = { ok: r.synced, reason: r.reason, days: r.days, totalPence: r.totalPence }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/group")
  revalidatePath("/financials")
  return summary
}
