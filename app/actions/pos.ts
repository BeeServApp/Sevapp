"use server"

import { and, asc, eq, gte, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import {
  posCategory,
  posProduct,
  posOrder,
  posOrderItem,
  posTerminal,
  type DbPosCategory,
  type DbPosProduct,
  type DbPosOrder,
  type DbPosOrderItem,
  type DbPosTerminal,
} from "@/lib/db/schema"
import { getAccountId, getCurrentUser, requireOwner } from "@/lib/session"
import { chargeTerminal } from "@/lib/pos-terminal"

// ── Menu (categories + products) ────────────────────────────────────────────

export interface PosMenu {
  categories: DbPosCategory[]
  products: DbPosProduct[]
}

export async function getPosMenu(venueId: number): Promise<PosMenu> {
  const accountId = await getAccountId()
  const [categories, products] = await Promise.all([
    db
      .select()
      .from(posCategory)
      .where(and(eq(posCategory.userId, accountId), eq(posCategory.venueId, venueId)))
      .orderBy(asc(posCategory.sortOrder), asc(posCategory.name)),
    db
      .select()
      .from(posProduct)
      .where(and(eq(posProduct.userId, accountId), eq(posProduct.venueId, venueId)))
      .orderBy(asc(posProduct.sortOrder), asc(posProduct.name)),
  ])
  return { categories, products }
}

export async function createPosCategory(input: {
  venueId: number
  name: string
  color?: string | null
}): Promise<DbPosCategory> {
  await requireOwner()
  const accountId = await getAccountId()
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${posCategory.sortOrder}), -1)` })
    .from(posCategory)
    .where(and(eq(posCategory.userId, accountId), eq(posCategory.venueId, input.venueId)))
  const [created] = await db
    .insert(posCategory)
    .values({
      userId: accountId,
      venueId: input.venueId,
      name: input.name.trim(),
      color: input.color || null,
      sortOrder: (maxRow?.max ?? -1) + 1,
    })
    .returning()
  revalidatePath("/pos")
  return created
}

export async function updatePosCategory(input: {
  id: number
  name: string
  color?: string | null
}): Promise<DbPosCategory> {
  await requireOwner()
  const accountId = await getAccountId()
  const [updated] = await db
    .update(posCategory)
    .set({ name: input.name.trim(), color: input.color || null })
    .where(and(eq(posCategory.id, input.id), eq(posCategory.userId, accountId)))
    .returning()
  if (!updated) throw new Error("Category not found")
  revalidatePath("/pos")
  return updated
}

export async function deletePosCategory(id: number): Promise<void> {
  await requireOwner()
  const accountId = await getAccountId()
  // Detach products from the category (keep the products themselves).
  await db
    .update(posProduct)
    .set({ categoryId: null })
    .where(and(eq(posProduct.categoryId, id), eq(posProduct.userId, accountId)))
  await db.delete(posCategory).where(and(eq(posCategory.id, id), eq(posCategory.userId, accountId)))
  revalidatePath("/pos")
}

export async function createPosProduct(input: {
  venueId: number
  categoryId: number | null
  name: string
  pricePence: number
  sku?: string | null
  color?: string | null
}): Promise<DbPosProduct> {
  await requireOwner()
  const accountId = await getAccountId()
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${posProduct.sortOrder}), -1)` })
    .from(posProduct)
    .where(and(eq(posProduct.userId, accountId), eq(posProduct.venueId, input.venueId)))
  const [created] = await db
    .insert(posProduct)
    .values({
      userId: accountId,
      venueId: input.venueId,
      categoryId: input.categoryId,
      name: input.name.trim(),
      pricePence: Math.max(0, Math.round(input.pricePence)),
      sku: input.sku || null,
      color: input.color || null,
      sortOrder: (maxRow?.max ?? -1) + 1,
    })
    .returning()
  revalidatePath("/pos")
  return created
}

export async function updatePosProduct(input: {
  id: number
  categoryId: number | null
  name: string
  pricePence: number
  sku?: string | null
  color?: string | null
  active?: boolean
}): Promise<DbPosProduct> {
  await requireOwner()
  const accountId = await getAccountId()
  const [updated] = await db
    .update(posProduct)
    .set({
      categoryId: input.categoryId,
      name: input.name.trim(),
      pricePence: Math.max(0, Math.round(input.pricePence)),
      sku: input.sku || null,
      color: input.color || null,
      ...(input.active === undefined ? {} : { active: input.active }),
    })
    .where(and(eq(posProduct.id, input.id), eq(posProduct.userId, accountId)))
    .returning()
  if (!updated) throw new Error("Product not found")
  revalidatePath("/pos")
  return updated
}

export async function deletePosProduct(id: number): Promise<void> {
  await requireOwner()
  const accountId = await getAccountId()
  await db.delete(posProduct).where(and(eq(posProduct.id, id), eq(posProduct.userId, accountId)))
  revalidatePath("/pos")
}

// ── Terminals ───────────────────────────────────────────────────────────────

export async function getPosTerminals(venueId: number): Promise<DbPosTerminal[]> {
  const accountId = await getAccountId()
  return db
    .select()
    .from(posTerminal)
    .where(and(eq(posTerminal.userId, accountId), eq(posTerminal.venueId, venueId)))
    .orderBy(asc(posTerminal.createdAt))
}

export async function linkPosTerminal(input: {
  venueId: number
  label: string
  deviceId: string
  provider?: string
}): Promise<DbPosTerminal> {
  await requireOwner()
  const accountId = await getAccountId()
  const [created] = await db
    .insert(posTerminal)
    .values({
      userId: accountId,
      venueId: input.venueId,
      provider: input.provider || "dojo",
      label: input.label.trim(),
      deviceId: input.deviceId.trim(),
    })
    .returning()
  revalidatePath("/pos")
  return created
}

export async function unlinkPosTerminal(id: number): Promise<void> {
  await requireOwner()
  const accountId = await getAccountId()
  await db.delete(posTerminal).where(and(eq(posTerminal.id, id), eq(posTerminal.userId, accountId)))
  revalidatePath("/pos")
}

// ── Checkout / sales ─────────────────────────────────────────────────────────

export interface PosSaleLine {
  productId: number | null
  name: string
  unitPricePence: number
  qty: number
}

export interface PosReceipt {
  order: DbPosOrder
  items: DbPosOrderItem[]
  simulated: boolean
}

/**
 * Record a completed sale. For card/terminal payments this first requests the
 * charge on the linked terminal (real hardware when configured, simulated
 * otherwise) and only persists the order once approved.
 */
export async function createPosSale(input: {
  venueId: number
  lines: PosSaleLine[]
  paymentMethod: "cash" | "card" | "terminal"
  tenderedPence?: number
  terminalId?: number | null
  note?: string
}): Promise<{ ok: boolean; error?: string; receipt?: PosReceipt }> {
  const accountId = await getAccountId()
  const me = await getCurrentUser()

  const lines = input.lines.filter((l) => l.qty > 0)
  if (lines.length === 0) return { ok: false, error: "The order is empty" }

  const subtotalPence = lines.reduce((sum, l) => sum + l.unitPricePence * l.qty, 0)
  const totalPence = subtotalPence

  let simulated = false
  let terminalRef: string | null = null
  let terminalId: number | null = null

  if (input.paymentMethod === "terminal") {
    if (!input.terminalId) return { ok: false, error: "Choose a card terminal" }
    const [terminal] = await db
      .select()
      .from(posTerminal)
      .where(and(eq(posTerminal.id, input.terminalId), eq(posTerminal.userId, accountId)))
      .limit(1)
    if (!terminal) return { ok: false, error: "Terminal not found" }
    const reference = `POS-${input.venueId}-${Date.now()}`
    const charge = await chargeTerminal({
      provider: terminal.provider,
      deviceId: terminal.deviceId,
      amountPence: totalPence,
      reference,
    })
    if (!charge.approved) return { ok: false, error: charge.message || "Payment declined" }
    simulated = charge.simulated
    terminalRef = charge.ref
    terminalId = terminal.id
  }

  const changePence =
    input.paymentMethod === "cash" && input.tenderedPence != null
      ? Math.max(0, input.tenderedPence - totalPence)
      : null

  const [order] = await db
    .insert(posOrder)
    .values({
      userId: accountId,
      venueId: input.venueId,
      status: "paid",
      subtotalPence,
      totalPence,
      paymentMethod: input.paymentMethod,
      tenderedPence: input.paymentMethod === "cash" ? (input.tenderedPence ?? totalPence) : null,
      changePence,
      terminalId,
      terminalRef,
      staffName: me.name,
      note: input.note?.trim() || null,
      paidAt: new Date(),
    })
    .returning()

  const items = await db
    .insert(posOrderItem)
    .values(
      lines.map((l) => ({
        userId: accountId,
        orderId: order.id,
        productId: l.productId,
        name: l.name,
        unitPricePence: l.unitPricePence,
        qty: l.qty,
        linePence: l.unitPricePence * l.qty,
      })),
    )
    .returning()

  revalidatePath("/pos")
  return { ok: true, receipt: { order, items, simulated } }
}

// ── Till summary (today) ─────────────────────────────────────────────────────

export interface PosTodaySummary {
  totalPence: number
  count: number
}

export async function getPosTodaySummary(venueId: number): Promise<PosTodaySummary> {
  const accountId = await getAccountId()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const [row] = await db
    .select({
      totalPence: sql<number>`coalesce(sum(${posOrder.totalPence}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(posOrder)
    .where(
      and(
        eq(posOrder.userId, accountId),
        eq(posOrder.venueId, venueId),
        eq(posOrder.status, "paid"),
        gte(posOrder.paidAt, start),
      ),
    )
  return { totalPence: Number(row?.totalPence ?? 0), count: Number(row?.count ?? 0) }
}
