"use server"

import { db } from "@/lib/db"
import { asset } from "@/lib/db/schema"
import { getAccountId as getUserId } from "@/lib/session"
import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

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
