import type { DbGamingEntry, DbGamingMachine } from "@/lib/db/schema"

/**
 * UK Machine Games Duty (MGD) bands. MGD is charged on a machine's net takings
 * (income after winnings/refills). Rates are stored in basis points (1% = 100bps)
 * so all maths stays in integers. Pool tables and video/arcade machines that
 * don't offer cash prizes are MGD-exempt.
 */
export const MGD_BANDS = [
  { key: "Lower", label: "Lower rate (5%)", bps: 500 },
  { key: "Standard", label: "Standard rate (20%)", bps: 2000 },
  { key: "Higher", label: "Higher rate (25%)", bps: 2500 },
  { key: "Exempt", label: "Exempt (0%)", bps: 0 },
] as const

export type MgdBand = (typeof MGD_BANDS)[number]["key"]

export const MACHINE_TYPES = [
  { key: "AWP", label: "AWP / fruit machine", defaultBand: "Standard" as MgdBand },
  { key: "Pool", label: "Pool table", defaultBand: "Exempt" as MgdBand },
  { key: "Video", label: "Video / arcade", defaultBand: "Exempt" as MgdBand },
  { key: "Other", label: "Other", defaultBand: "Standard" as MgdBand },
] as const

export type MachineType = (typeof MACHINE_TYPES)[number]["key"]

export function bpsForBand(band: string): number {
  return MGD_BANDS.find((b) => b.key === band)?.bps ?? 0
}

export function bandLabel(band: string): string {
  return MGD_BANDS.find((b) => b.key === band)?.label ?? band
}

export function defaultBandForType(type: string): MgdBand {
  return MACHINE_TYPES.find((t) => t.key === type)?.defaultBand ?? "Standard"
}

export interface ComputedSplit {
  netPence: number
  mgdPence: number
  locationSharePence: number
  supplierSharePence: number
}

/**
 * Core revenue split, reverse-engineered from the operator (Rudd Group) report:
 *   Net           = Total income − refills & sundries
 *   MGD           = Net × MGD rate
 *   Location share = (Net − MGD) × location share %
 *   Supplier share = remainder of (Net − MGD)
 */
export function computeSplit(args: {
  totalIncomePence: number
  refillsPence: number
  mgdRateBps: number
  locationSharePct: number
}): ComputedSplit {
  const netPence = Math.max(0, Math.round(args.totalIncomePence - args.refillsPence))
  const mgdPence = Math.round((netPence * args.mgdRateBps) / 10000)
  const afterMgd = netPence - mgdPence
  const locationSharePence = Math.round((afterMgd * args.locationSharePct) / 100)
  const supplierSharePence = afterMgd - locationSharePence
  return { netPence, mgdPence, locationSharePence, supplierSharePence }
}

export interface GamingTotals {
  totalIncomePence: number
  refillsPence: number
  netPence: number
  mgdPence: number
  locationSharePence: number
  supplierSharePence: number
  entryCount: number
}

export function sumEntries(entries: DbGamingEntry[]): GamingTotals {
  return entries.reduce<GamingTotals>(
    (acc, e) => ({
      totalIncomePence: acc.totalIncomePence + e.totalIncomePence,
      refillsPence: acc.refillsPence + e.refillsPence,
      netPence: acc.netPence + e.netPence,
      mgdPence: acc.mgdPence + e.mgdPence,
      locationSharePence: acc.locationSharePence + e.locationSharePence,
      supplierSharePence: acc.supplierSharePence + e.supplierSharePence,
      entryCount: acc.entryCount + 1,
    }),
    {
      totalIncomePence: 0,
      refillsPence: 0,
      netPence: 0,
      mgdPence: 0,
      locationSharePence: 0,
      supplierSharePence: 0,
      entryCount: 0,
    },
  )
}

/** Filter entries to a YYYY-MM month key by collection date. */
export function entriesForMonth(entries: DbGamingEntry[], monthKey: string): DbGamingEntry[] {
  return entries.filter((e) => e.collectionDateISO.slice(0, 7) === monthKey)
}

export type GamingMachineWithEntries = DbGamingMachine & { entries: DbGamingEntry[] }
