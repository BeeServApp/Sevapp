"use server"

import { db } from "@/lib/db"
import { asset, maintenance } from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { and, asc, desc, eq, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import type { MaintenancePriority, MaintenanceStatus } from "@/lib/asset-types"

export async function getAssets(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(asset)
    .where(and(eq(asset.userId, userId), eq(asset.venueId, venueId)))
    .orderBy(asc(asset.id))
}

export async function createAsset(data: {
  venueId: number
  assetNumber: string
  name: string
  description: string
  category: string
  serial: string
  price: number
  purchaseDate: string
  disposalDate: string
  condition: string
  location: string
  photo: string
}) {
  const userId = await getUserId()
  if (!data.name.trim()) throw new Error("Asset name is required")

  const [created] = await db
    .insert(asset)
    .values({
      userId,
      venueId: data.venueId,
      assetNumber: data.assetNumber,
      name: data.name.trim(),
      description: data.description,
      category: data.category,
      serial: data.serial,
      price: Math.round(data.price),
      purchaseDate: data.purchaseDate,
      disposalDate: data.disposalDate || null,
      condition: data.condition,
      location: data.location,
      photo: data.photo,
    })
    .returning()

  revalidatePath("/assets")
  return created
}

export async function updateAsset(
  id: number,
  data: {
    assetNumber: string
    name: string
    description: string
    category: string
    serial: string
    price: number
    purchaseDate: string
    disposalDate: string
    condition: string
    location: string
    photo: string
  },
) {
  const userId = await getUserId()
  if (!data.name.trim()) throw new Error("Asset name is required")
  if (!data.assetNumber.trim()) throw new Error("Asset number is required")

  const [updated] = await db
    .update(asset)
    .set({
      assetNumber: data.assetNumber.trim(),
      name: data.name.trim(),
      description: data.description,
      category: data.category,
      serial: data.serial,
      price: Math.round(data.price),
      purchaseDate: data.purchaseDate,
      disposalDate: data.disposalDate || null,
      condition: data.condition,
      location: data.location,
      photo: data.photo,
    })
    .where(and(eq(asset.id, id), eq(asset.userId, userId)))
    .returning()

  revalidatePath("/assets")
  return updated
}

export async function deleteAsset(id: number) {
  const userId = await getUserId()
  await db.delete(asset).where(and(eq(asset.id, id), eq(asset.userId, userId)))
  revalidatePath("/assets")
}

/* --------------------------- Maintenance log ---------------------------- */

// All maintenance records for the venue that are linked to an asset.
export async function getAssetMaintenance(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(maintenance)
    .where(
      and(
        eq(maintenance.userId, userId),
        eq(maintenance.venueId, venueId),
        isNotNull(maintenance.assetId),
      ),
    )
    .orderBy(desc(maintenance.id))
}

export async function createAssetMaintenance(data: {
  venueId: number
  assetId: number
  assetName: string
  issue: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  assignee: string
  costPence: number
  loggedDate: string
}) {
  const userId = await getUserId()
  if (!data.issue.trim()) throw new Error("Please describe the maintenance issue")

  const [created] = await db
    .insert(maintenance)
    .values({
      userId,
      venueId: data.venueId,
      assetId: data.assetId,
      assetName: data.assetName,
      issue: data.issue.trim(),
      priority: data.priority,
      status: data.status,
      assignee: data.assignee.trim() || null,
      costPence: Number.isFinite(data.costPence) ? Math.round(data.costPence) : 0,
      loggedDate: data.loggedDate || null,
    })
    .returning()

  revalidatePath("/assets")
  revalidatePath("/operations")
  return created
}

export async function updateAssetMaintenanceStatus(id: number, status: MaintenanceStatus) {
  const userId = await getUserId()
  await db
    .update(maintenance)
    .set({ status })
    .where(and(eq(maintenance.id, id), eq(maintenance.userId, userId)))
  revalidatePath("/assets")
  revalidatePath("/operations")
}

export async function deleteAssetMaintenance(id: number) {
  const userId = await getUserId()
  await db.delete(maintenance).where(and(eq(maintenance.id, id), eq(maintenance.userId, userId)))
  revalidatePath("/assets")
  revalidatePath("/operations")
}
