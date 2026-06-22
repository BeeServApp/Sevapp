"use server"

import { db } from "@/lib/db"
import { gamingMachine, gamingEntry } from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { bpsForBand, computeSplit, type GamingMachineWithEntries } from "@/lib/gaming"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const GAMING_PATH = "/financials"

export async function getGamingMachines(venueId: number): Promise<GamingMachineWithEntries[]> {
  const userId = await getUserId()
  const [machines, entries] = await Promise.all([
    db
      .select()
      .from(gamingMachine)
      .where(and(eq(gamingMachine.userId, userId), eq(gamingMachine.venueId, venueId)))
      .orderBy(asc(gamingMachine.id)),
    db
      .select()
      .from(gamingEntry)
      .where(and(eq(gamingEntry.userId, userId), eq(gamingEntry.venueId, venueId)))
      .orderBy(desc(gamingEntry.collectionDateISO)),
  ])
  return machines.map((m) => ({
    ...m,
    entries: entries.filter((e) => e.machineId === m.id),
  }))
}

export async function createGamingMachine(data: {
  venueId: number
  name: string
  siteCode: string
  machineType: string
  mgdBand: string
  locationSharePct: number
  assetId: number | null
}) {
  const userId = await getUserId()
  if (!data.name.trim()) throw new Error("Machine name is required")
  const [created] = await db
    .insert(gamingMachine)
    .values({
      userId,
      venueId: data.venueId,
      name: data.name.trim(),
      siteCode: data.siteCode.trim() || null,
      machineType: data.machineType,
      mgdBand: data.mgdBand,
      locationSharePct: clampPct(data.locationSharePct),
      assetId: data.assetId,
    })
    .returning()
  revalidatePath(GAMING_PATH)
  return created
}

export async function updateGamingMachine(
  id: number,
  data: {
    name: string
    siteCode: string
    machineType: string
    mgdBand: string
    locationSharePct: number
    assetId: number | null
    active: boolean
  },
) {
  const userId = await getUserId()
  if (!data.name.trim()) throw new Error("Machine name is required")
  const [updated] = await db
    .update(gamingMachine)
    .set({
      name: data.name.trim(),
      siteCode: data.siteCode.trim() || null,
      machineType: data.machineType,
      mgdBand: data.mgdBand,
      locationSharePct: clampPct(data.locationSharePct),
      assetId: data.assetId,
      active: data.active,
    })
    .where(and(eq(gamingMachine.id, id), eq(gamingMachine.userId, userId)))
    .returning()
  revalidatePath(GAMING_PATH)
  return updated
}

export async function deleteGamingMachine(id: number) {
  const userId = await getUserId()
  await db
    .delete(gamingEntry)
    .where(and(eq(gamingEntry.machineId, id), eq(gamingEntry.userId, userId)))
  await db
    .delete(gamingMachine)
    .where(and(eq(gamingMachine.id, id), eq(gamingMachine.userId, userId)))
  revalidatePath(GAMING_PATH)
}

export async function createGamingEntry(data: {
  venueId: number
  machineId: number
  collectionDateISO: string
  days: number
  totalIncomePence: number
  refillsPence: number
  notes: string
}) {
  const userId = await getUserId()

  // Resolve the machine to snapshot its MGD band + location share at entry time.
  const [machine] = await db
    .select()
    .from(gamingMachine)
    .where(and(eq(gamingMachine.id, data.machineId), eq(gamingMachine.userId, userId)))
  if (!machine) throw new Error("Machine not found")

  const mgdRateBps = bpsForBand(machine.mgdBand)
  const split = computeSplit({
    totalIncomePence: data.totalIncomePence,
    refillsPence: data.refillsPence,
    mgdRateBps,
    locationSharePct: machine.locationSharePct,
  })

  const [created] = await db
    .insert(gamingEntry)
    .values({
      userId,
      venueId: data.venueId,
      machineId: data.machineId,
      collectionDateISO: data.collectionDateISO,
      days: data.days,
      totalIncomePence: data.totalIncomePence,
      refillsPence: data.refillsPence,
      netPence: split.netPence,
      mgdRateBps,
      mgdPence: split.mgdPence,
      locationSharePct: machine.locationSharePct,
      locationSharePence: split.locationSharePence,
      supplierSharePence: split.supplierSharePence,
      notes: data.notes.trim() || null,
    })
    .returning()
  revalidatePath(GAMING_PATH)
  return created
}

export async function deleteGamingEntry(id: number) {
  const userId = await getUserId()
  await db.delete(gamingEntry).where(and(eq(gamingEntry.id, id), eq(gamingEntry.userId, userId)))
  revalidatePath(GAMING_PATH)
}

function clampPct(pct: number) {
  if (Number.isNaN(pct)) return 50
  return Math.max(0, Math.min(100, Math.round(pct)))
}
