"use server"

import { db } from "@/lib/db"
import { asset, certificate, complianceCheck, stockProduct } from "@/lib/db/schema"
import { getAccountId, guardOwnerPage } from "@/lib/session"
import { computeVenueScore, type VenueScore } from "@/lib/kiosk-score"
import { getVenues } from "@/app/actions/venues"
import { eq } from "drizzle-orm"

export interface VenueScoreRow {
  venueId: number
  name: string
  location: string
  score: VenueScore
}

/**
 * Venue scorecards for the group + single dashboards. Each venue's live kiosk
 * score (tasks + punctuality) is computed for today. Owner-only.
 */
export async function getVenueScores(): Promise<VenueScoreRow[]> {
  await guardOwnerPage()
  const accountId = await getAccountId()
  const venues = await getVenues()

  const rows = await Promise.all(
    venues.map(async (v) => {
      const score = await computeVenueScore(accountId, v.id)
      return {
        venueId: v.id,
        name: v.name,
        location: v.city ?? v.type ?? "—",
        score,
      }
    }),
  )
  return rows.sort((a, b) => b.score.score - a.score.score)
}

/** The score for a single venue (used on the single-venue dashboard). */
export async function getVenueScore(venueId: number): Promise<VenueScore> {
  const accountId = await getAccountId()
  return computeVenueScore(accountId, venueId)
}

/* ------------------------------ Group assets ------------------------------ */

export interface GroupAssetVenueRow {
  venueId: number
  name: string
  location: string
  assetCount: number
  totalValue: number // whole pounds (asset.price is stored in pounds)
  categories: Record<string, number>
}

export interface GroupAssetLine {
  venue: string
  assetNumber: string
  name: string
  category: string
  condition: string
  purchaseDate: string
  price: number
}

export interface GroupAssetSummary {
  venues: GroupAssetVenueRow[]
  totalValue: number
  totalCount: number
  categoryTotals: { category: string; value: number; count: number }[]
  lines: GroupAssetLine[]
}

export async function getGroupAssetSummary(): Promise<GroupAssetSummary> {
  await guardOwnerPage()
  const userId = await getAccountId()
  const venues = await getVenues()

  const all = await db.select().from(asset).where(eq(asset.userId, userId))
  const active = all.filter((a) => !a.disposalDate)

  const catMap = new Map<string, { value: number; count: number }>()
  const venueRows: GroupAssetVenueRow[] = venues.map((v) => {
    const vAssets = active.filter((a) => a.venueId === v.id)
    const categories: Record<string, number> = {}
    let totalValue = 0
    for (const a of vAssets) {
      totalValue += a.price
      categories[a.category] = (categories[a.category] ?? 0) + a.price
      const c = catMap.get(a.category) ?? { value: 0, count: 0 }
      c.value += a.price
      c.count += 1
      catMap.set(a.category, c)
    }
    return {
      venueId: v.id,
      name: v.name,
      location: v.city ?? v.type ?? "—",
      assetCount: vAssets.length,
      totalValue,
      categories,
    }
  })

  const venueName = new Map(venues.map((v) => [v.id, v.name]))
  const lines: GroupAssetLine[] = active
    .map((a) => ({
      venue: venueName.get(a.venueId) ?? "—",
      assetNumber: a.assetNumber,
      name: a.name,
      category: a.category,
      condition: a.condition,
      purchaseDate: a.purchaseDate ?? "",
      price: a.price,
    }))
    .sort((a, b) => a.venue.localeCompare(b.venue) || b.price - a.price)

  return {
    venues: venueRows.sort((a, b) => b.totalValue - a.totalValue),
    totalValue: active.reduce((s, a) => s + a.price, 0),
    totalCount: active.length,
    categoryTotals: [...catMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.value - a.value),
    lines,
  }
}

/* ---------------------------- Group compliance ---------------------------- */

export interface GroupComplianceVenueRow {
  venueId: number
  name: string
  location: string
  checksTotal: number
  checksComplete: number
  checksOverdue: number
  certsTotal: number
  certsExpiring: number
  compliancePct: number
}

export interface GroupComplianceSummary {
  venues: GroupComplianceVenueRow[]
  checksTotal: number
  checksComplete: number
  checksOverdue: number
  certsExpiring: number
  compliancePct: number
}

function isOverdue(status: string) {
  const s = status.toLowerCase()
  return s === "overdue" || s === "due"
}

function isExpiring(status: string) {
  const s = status.toLowerCase()
  return s === "expiring" || s === "expired" || s === "due"
}

export async function getGroupComplianceSummary(): Promise<GroupComplianceSummary> {
  await guardOwnerPage()
  const userId = await getAccountId()
  const venues = await getVenues()

  const [allChecks, allCerts] = await Promise.all([
    db.select().from(complianceCheck).where(eq(complianceCheck.userId, userId)),
    db.select().from(certificate).where(eq(certificate.userId, userId)),
  ])

  const venueRows: GroupComplianceVenueRow[] = venues.map((v) => {
    const checks = allChecks.filter((c) => c.venueId === v.id)
    const certs = allCerts.filter((c) => c.venueId === v.id)
    const complete = checks.filter((c) => c.status.toLowerCase() === "complete").length
    const overdue = checks.filter((c) => isOverdue(c.status)).length
    const expiring = certs.filter((c) => isExpiring(c.status)).length
    const compliancePct = checks.length > 0 ? Math.round((complete / checks.length) * 100) : 100
    return {
      venueId: v.id,
      name: v.name,
      location: v.city ?? v.type ?? "—",
      checksTotal: checks.length,
      checksComplete: complete,
      checksOverdue: overdue,
      certsTotal: certs.length,
      certsExpiring: expiring,
      compliancePct,
    }
  })

  const checksTotal = allChecks.length
  const checksComplete = allChecks.filter((c) => c.status.toLowerCase() === "complete").length
  const checksOverdue = allChecks.filter((c) => isOverdue(c.status)).length
  const certsExpiring = allCerts.filter((c) => isExpiring(c.status)).length

  return {
    venues: venueRows.sort((a, b) => a.compliancePct - b.compliancePct),
    checksTotal,
    checksComplete,
    checksOverdue,
    certsExpiring,
    compliancePct: checksTotal > 0 ? Math.round((checksComplete / checksTotal) * 100) : 100,
  }
}

/* ------------------------------- Group stock ------------------------------ */

export interface GroupStockVenueRow {
  venueId: number
  name: string
  location: string
  productCount: number
  stockValuePence: number
  retailValuePence: number
  belowParCount: number
}

export interface GroupStockSummary {
  venues: GroupStockVenueRow[]
  stockValuePence: number
  retailValuePence: number
  productCount: number
  belowParCount: number
}

export async function getGroupStockSummary(): Promise<GroupStockSummary> {
  await guardOwnerPage()
  const userId = await getAccountId()
  const venues = await getVenues()

  const products = await db.select().from(stockProduct).where(eq(stockProduct.userId, userId))

  const venueRows: GroupStockVenueRow[] = venues.map((v) => {
    const vProducts = products.filter((p) => p.venueId === v.id)
    let stockValue = 0
    let retailValue = 0
    let belowPar = 0
    for (const p of vProducts) {
      stockValue += Math.round((p.onHandQty ?? 0) * (p.costPricePence ?? 0))
      retailValue += Math.round((p.onHandQty ?? 0) * (p.salePricePence ?? 0))
      if ((p.onHandQty ?? 0) < (p.parLevel ?? 0)) belowPar += 1
    }
    return {
      venueId: v.id,
      name: v.name,
      location: v.city ?? v.type ?? "—",
      productCount: vProducts.length,
      stockValuePence: stockValue,
      retailValuePence: retailValue,
      belowParCount: belowPar,
    }
  })

  return {
    venues: venueRows.sort((a, b) => b.stockValuePence - a.stockValuePence),
    stockValuePence: venueRows.reduce((s, v) => s + v.stockValuePence, 0),
    retailValuePence: venueRows.reduce((s, v) => s + v.retailValuePence, 0),
    productCount: products.length,
    belowParCount: venueRows.reduce((s, v) => s + v.belowParCount, 0),
  }
}
