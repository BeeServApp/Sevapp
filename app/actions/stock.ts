"use server"

import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  order,
  stockCount,
  stockCountItem,
  stockOrderItem,
  stockProduct,
  stockTransfer,
  supplier,
  venue,
} from "@/lib/db/schema"
import { getAccountId, requireOwner } from "@/lib/session"
import { emitChange } from "@/lib/realtime"

const STOCK_PATH = "/stock"

/* -------------------------------- Products -------------------------------- */

export async function getProducts(venueId: number) {
  const userId = await getAccountId()
  return db
    .select()
    .from(stockProduct)
    .where(and(eq(stockProduct.userId, userId), eq(stockProduct.venueId, venueId)))
    .orderBy(asc(stockProduct.name))
}

export interface ProductInput {
  venueId: number
  name: string
  sku?: string
  barcode?: string
  category: string
  unit: string
  packSize: number
  supplierId?: number | null
  costPricePence: number
  salePricePence: number
  vatRatePct: number
  parLevel: number
  onHandQty: number
}

/**
 * Create a product. Restricted to the account owner (the "super user") — staff
 * and managers can order and count stock but cannot define the catalogue.
 */
export async function createProduct(data: ProductInput) {
  const me = await requireOwner()
  const userId = me.accountId
  const name = data.name.trim()
  if (!name) throw new Error("Product name is required")

  const [created] = await db
    .insert(stockProduct)
    .values({
      userId,
      venueId: data.venueId,
      name,
      sku: data.sku?.trim() || null,
      barcode: data.barcode?.trim() || null,
      category: data.category || "General",
      unit: data.unit || "each",
      packSize: intOr(data.packSize, 1),
      supplierId: data.supplierId ?? null,
      costPricePence: intOr(data.costPricePence, 0),
      salePricePence: intOr(data.salePricePence, 0),
      vatRatePct: intOr(data.vatRatePct, 20),
      parLevel: numOr(data.parLevel, 0),
      onHandQty: numOr(data.onHandQty, 0),
      active: true,
    })
    .returning()

  revalidatePath(STOCK_PATH)
  await emitChange(userId, "all")
  return created
}

export async function updateProduct(id: number, data: ProductInput) {
  const me = await requireOwner()
  const userId = me.accountId
  await db
    .update(stockProduct)
    .set({
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      barcode: data.barcode?.trim() || null,
      category: data.category || "General",
      unit: data.unit || "each",
      packSize: intOr(data.packSize, 1),
      supplierId: data.supplierId ?? null,
      costPricePence: intOr(data.costPricePence, 0),
      salePricePence: intOr(data.salePricePence, 0),
      vatRatePct: intOr(data.vatRatePct, 20),
      parLevel: numOr(data.parLevel, 0),
      onHandQty: numOr(data.onHandQty, 0),
    })
    .where(and(eq(stockProduct.id, id), eq(stockProduct.userId, userId)))
  revalidatePath(STOCK_PATH)
  await emitChange(userId, "all")
}

export async function deleteProduct(id: number) {
  const me = await requireOwner()
  await db
    .delete(stockProduct)
    .where(and(eq(stockProduct.id, id), eq(stockProduct.userId, me.accountId)))
  revalidatePath(STOCK_PATH)
  await emitChange(me.accountId, "all")
}

/* -------------------------------- Suppliers ------------------------------- */

export async function getStockSuppliers(venueId: number) {
  const userId = await getAccountId()
  return db
    .select()
    .from(supplier)
    .where(and(eq(supplier.userId, userId), eq(supplier.venueId, venueId)))
    .orderBy(asc(supplier.name))
}

export async function createStockSupplier(data: {
  venueId: number
  name: string
  category?: string
  terms: string
}) {
  const userId = await getAccountId()
  const name = data.name.trim()
  if (!name) throw new Error("Supplier name is required")
  const [created] = await db
    .insert(supplier)
    .values({
      userId,
      venueId: data.venueId,
      name,
      category: data.category?.trim() || null,
      terms: data.terms || "Net 30",
      spendMtdPence: 0,
      rating: "4.5",
    })
    .returning()
  revalidatePath(STOCK_PATH)
  return created
}

export async function updateStockSupplier(
  id: number,
  data: { name: string; category?: string; terms: string },
) {
  const userId = await getAccountId()
  await db
    .update(supplier)
    .set({
      name: data.name.trim(),
      category: data.category?.trim() || null,
      terms: data.terms,
    })
    .where(and(eq(supplier.id, id), eq(supplier.userId, userId)))
  revalidatePath(STOCK_PATH)
}

export async function deleteStockSupplier(id: number) {
  const userId = await getAccountId()
  await db.delete(supplier).where(and(eq(supplier.id, id), eq(supplier.userId, userId)))
  revalidatePath(STOCK_PATH)
}

/* --------------------------------- Orders --------------------------------- */

export async function getStockOrders(venueId: number) {
  const userId = await getAccountId()
  return db
    .select()
    .from(order)
    .where(and(eq(order.userId, userId), eq(order.venueId, venueId)))
    .orderBy(desc(order.id))
}

export async function getOrderItems(orderId: number) {
  const userId = await getAccountId()
  return db
    .select()
    .from(stockOrderItem)
    .where(and(eq(stockOrderItem.userId, userId), eq(stockOrderItem.orderId, orderId)))
    .orderBy(asc(stockOrderItem.id))
}

export interface OrderLineInput {
  productId: number | null
  name: string
  qty: number
  unitCostPence: number
}

/**
 * Create a purchase order from a product "shopping list". Each line captures a
 * product, quantity and unit cost; the order total and item count are derived.
 */
export async function createStockOrder(data: {
  venueId: number
  reference: string
  supplier: string
  status?: string
  due?: string
  lines: OrderLineInput[]
}) {
  const userId = await getAccountId()
  const reference = data.reference.trim()
  const supplierName = data.supplier.trim()
  if (!reference) throw new Error("Order reference is required")
  if (!supplierName) throw new Error("Supplier is required")

  const lines = (data.lines ?? []).filter((l) => l.name.trim() && numOr(l.qty, 0) > 0)
  const totalPence = lines.reduce((sum, l) => sum + Math.round(numOr(l.qty, 0) * intOr(l.unitCostPence, 0)), 0)
  const itemCount = lines.reduce((sum, l) => sum + numOr(l.qty, 0), 0)

  const [created] = await db
    .insert(order)
    .values({
      userId,
      venueId: data.venueId,
      reference,
      supplier: supplierName,
      items: Math.round(itemCount),
      totalPence,
      status: data.status || "Draft",
      due: data.due?.trim() || "—",
    })
    .returning()

  if (lines.length > 0) {
    await db.insert(stockOrderItem).values(
      lines.map((l) => ({
        userId,
        orderId: created.id,
        productId: l.productId ?? null,
        name: l.name.trim(),
        qty: numOr(l.qty, 0),
        unitCostPence: intOr(l.unitCostPence, 0),
        linePence: Math.round(numOr(l.qty, 0) * intOr(l.unitCostPence, 0)),
      })),
    )
  }

  revalidatePath(STOCK_PATH)
  await emitChange(userId, "all")
  return created
}

/**
 * Update an order's status. When marked "Delivered", the ordered quantities are
 * received into stock: each line's product has its on-hand quantity increased.
 */
export async function updateStockOrderStatus(id: number, status: string) {
  const userId = await getAccountId()
  const [existing] = await db
    .select()
    .from(order)
    .where(and(eq(order.id, id), eq(order.userId, userId)))
    .limit(1)
  if (!existing) throw new Error("Order not found")

  await db.update(order).set({ status }).where(and(eq(order.id, id), eq(order.userId, userId)))

  // Receive stock exactly once, on the transition into "Delivered".
  if (status === "Delivered" && existing.status !== "Delivered") {
    const items = await db
      .select()
      .from(stockOrderItem)
      .where(and(eq(stockOrderItem.userId, userId), eq(stockOrderItem.orderId, id)))
    for (const it of items) {
      if (it.productId == null) continue
      const [p] = await db
        .select({ onHandQty: stockProduct.onHandQty })
        .from(stockProduct)
        .where(and(eq(stockProduct.id, it.productId), eq(stockProduct.userId, userId)))
        .limit(1)
      if (!p) continue
      await db
        .update(stockProduct)
        .set({ onHandQty: (p.onHandQty ?? 0) + it.qty })
        .where(and(eq(stockProduct.id, it.productId), eq(stockProduct.userId, userId)))
    }
  }

  revalidatePath(STOCK_PATH)
  await emitChange(userId, "all")
}

export async function deleteStockOrder(id: number) {
  const userId = await getAccountId()
  await db.delete(stockOrderItem).where(and(eq(stockOrderItem.userId, userId), eq(stockOrderItem.orderId, id)))
  await db.delete(order).where(and(eq(order.id, id), eq(order.userId, userId)))
  revalidatePath(STOCK_PATH)
  await emitChange(userId, "all")
}

/* ------------------------------- Stock takes ------------------------------ */

export async function getStockCounts(venueId: number) {
  const userId = await getAccountId()
  return db
    .select()
    .from(stockCount)
    .where(and(eq(stockCount.userId, userId), eq(stockCount.venueId, venueId)))
    .orderBy(desc(stockCount.id))
}

export async function getStockCountItems(countId: number) {
  const userId = await getAccountId()
  return db
    .select()
    .from(stockCountItem)
    .where(and(eq(stockCountItem.userId, userId), eq(stockCountItem.countId, countId)))
    .orderBy(asc(stockCountItem.name))
}

/**
 * Start a stock take: snapshot every active product's current on-hand quantity
 * as the "expected" figure, then let the counter enter actuals per line.
 */
export async function startStockCount(data: {
  venueId: number
  reference: string
  area?: string
  countedBy?: string
}) {
  const userId = await getAccountId()
  const reference = data.reference.trim()
  if (!reference) throw new Error("A reference is required")

  const products = await db
    .select()
    .from(stockProduct)
    .where(
      and(
        eq(stockProduct.userId, userId),
        eq(stockProduct.venueId, data.venueId),
        eq(stockProduct.active, true),
      ),
    )
  if (products.length === 0) throw new Error("Add some products before starting a stock take")

  const [created] = await db
    .insert(stockCount)
    .values({
      userId,
      venueId: data.venueId,
      reference,
      area: data.area?.trim() || null,
      countedBy: data.countedBy?.trim() || null,
      status: "In progress",
    })
    .returning()

  await db.insert(stockCountItem).values(
    products.map((p) => ({
      userId,
      countId: created.id,
      productId: p.id,
      name: p.name,
      expectedQty: p.onHandQty ?? 0,
      countedQty: p.onHandQty ?? 0,
      unitCostPence: p.costPricePence ?? 0,
    })),
  )

  revalidatePath(STOCK_PATH)
  return created
}

export async function updateCountItemQty(itemId: number, countedQty: number) {
  const userId = await getAccountId()
  await db
    .update(stockCountItem)
    .set({ countedQty: numOr(countedQty, 0) })
    .where(and(eq(stockCountItem.id, itemId), eq(stockCountItem.userId, userId)))
  revalidatePath(STOCK_PATH)
}

/**
 * Complete a stock take: compute expected/counted valuations and variance, then
 * reconcile each product's on-hand quantity to the counted figure.
 */
export async function completeStockCount(countId: number) {
  const userId = await getAccountId()
  const items = await db
    .select()
    .from(stockCountItem)
    .where(and(eq(stockCountItem.userId, userId), eq(stockCountItem.countId, countId)))

  let expectedValue = 0
  let countedValue = 0
  for (const it of items) {
    expectedValue += Math.round(it.expectedQty * it.unitCostPence)
    countedValue += Math.round(it.countedQty * it.unitCostPence)
    // Reconcile the product's live on-hand quantity to what was counted.
    if (it.productId != null) {
      await db
        .update(stockProduct)
        .set({ onHandQty: it.countedQty })
        .where(and(eq(stockProduct.id, it.productId), eq(stockProduct.userId, userId)))
    }
  }

  await db
    .update(stockCount)
    .set({
      status: "Completed",
      expectedValuePence: expectedValue,
      countedValuePence: countedValue,
      varianceValuePence: countedValue - expectedValue,
      completedAt: new Date(),
    })
    .where(and(eq(stockCount.id, countId), eq(stockCount.userId, userId)))

  revalidatePath(STOCK_PATH)
  await emitChange(userId, "all")
}

export async function deleteStockCount(id: number) {
  const userId = await getAccountId()
  await db.delete(stockCountItem).where(and(eq(stockCountItem.userId, userId), eq(stockCountItem.countId, id)))
  await db.delete(stockCount).where(and(eq(stockCount.id, id), eq(stockCount.userId, userId)))
  revalidatePath(STOCK_PATH)
}

/* ------------------------------- Transfers -------------------------------- */

export async function getStockTransfers() {
  const userId = await getAccountId()
  return db
    .select()
    .from(stockTransfer)
    .where(eq(stockTransfer.userId, userId))
    .orderBy(desc(stockTransfer.id))
}

/**
 * Move stock from one venue to another. Deducts the quantity from the source
 * product and adds it to a matching product at the destination (matched by
 * name, created there if it doesn't already exist), then logs the movement.
 * Owner-only, since it spans venues.
 */
export async function transferStock(data: {
  fromVenueId: number
  fromProductId: number
  toVenueId: number
  qty: number
  note?: string
  movedBy?: string
}) {
  const me = await requireOwner()
  const userId = me.accountId
  const qty = numOr(data.qty, 0)
  if (qty <= 0) throw new Error("Enter a quantity greater than zero")
  if (data.fromVenueId === data.toVenueId) throw new Error("Choose a different destination venue")

  // Load and verify the source product.
  const [source] = await db
    .select()
    .from(stockProduct)
    .where(
      and(
        eq(stockProduct.id, data.fromProductId),
        eq(stockProduct.userId, userId),
        eq(stockProduct.venueId, data.fromVenueId),
      ),
    )
    .limit(1)
  if (!source) throw new Error("Source product not found")
  if (qty > (source.onHandQty ?? 0)) throw new Error("Not enough stock on hand to transfer")

  // Verify the destination venue belongs to this account.
  const [dest] = await db
    .select({ id: venue.id })
    .from(venue)
    .where(and(eq(venue.id, data.toVenueId), eq(venue.userId, userId)))
    .limit(1)
  if (!dest) throw new Error("Destination venue not found")

  const valuePence = Math.round(qty * (source.costPricePence ?? 0))
  let toProductId: number | null = null

  await db.transaction(async (tx) => {
    // Deduct from source.
    await tx
      .update(stockProduct)
      .set({ onHandQty: (source.onHandQty ?? 0) - qty })
      .where(and(eq(stockProduct.id, source.id), eq(stockProduct.userId, userId)))

    // Find a matching product at the destination by (case-insensitive) name.
    const destProducts = await tx
      .select()
      .from(stockProduct)
      .where(and(eq(stockProduct.userId, userId), eq(stockProduct.venueId, data.toVenueId)))
    const match = destProducts.find((p) => p.name.trim().toLowerCase() === source.name.trim().toLowerCase())

    if (match) {
      toProductId = match.id
      await tx
        .update(stockProduct)
        .set({ onHandQty: (match.onHandQty ?? 0) + qty })
        .where(and(eq(stockProduct.id, match.id), eq(stockProduct.userId, userId)))
    } else {
      // Recreate the product at the destination, carrying over its attributes.
      const [created] = await tx
        .insert(stockProduct)
        .values({
          userId,
          venueId: data.toVenueId,
          name: source.name,
          sku: source.sku,
          barcode: source.barcode,
          category: source.category,
          unit: source.unit,
          packSize: source.packSize,
          supplierId: null,
          costPricePence: source.costPricePence,
          salePricePence: source.salePricePence,
          vatRatePct: source.vatRatePct,
          parLevel: source.parLevel,
          onHandQty: qty,
          active: true,
        })
        .returning({ id: stockProduct.id })
      toProductId = created.id
    }

    await tx.insert(stockTransfer).values({
      userId,
      fromVenueId: data.fromVenueId,
      toVenueId: data.toVenueId,
      fromProductId: source.id,
      toProductId,
      productName: source.name,
      qty,
      unitCostPence: source.costPricePence ?? 0,
      valuePence,
      note: data.note?.trim() || null,
      movedBy: data.movedBy?.trim() || null,
    })
  })

  revalidatePath(STOCK_PATH)
  revalidatePath("/stock/group")
  await emitChange(userId, "all")
  return { ok: true, valuePence }
}

/* -------------------------------- Analytics ------------------------------- */

export interface StockAnalytics {
  productCount: number
  stockValuePence: number
  retailValuePence: number
  potentialProfitPence: number
  avgMarginPct: number
  belowParCount: number
  categories: { category: string; valuePence: number; count: number }[]
  topValue: { name: string; valuePence: number }[]
  lastVariancePence: number | null
}

export async function getStockAnalytics(venueId: number): Promise<StockAnalytics> {
  const userId = await getAccountId()
  const products = await db
    .select()
    .from(stockProduct)
    .where(and(eq(stockProduct.userId, userId), eq(stockProduct.venueId, venueId)))

  let stockValue = 0
  let retailValue = 0
  let marginSum = 0
  let marginCount = 0
  let belowPar = 0
  const catMap = new Map<string, { valuePence: number; count: number }>()

  for (const p of products) {
    const value = Math.round((p.onHandQty ?? 0) * (p.costPricePence ?? 0))
    const retail = Math.round((p.onHandQty ?? 0) * (p.salePricePence ?? 0))
    stockValue += value
    retailValue += retail
    if (p.salePricePence > 0) {
      marginSum += ((p.salePricePence - p.costPricePence) / p.salePricePence) * 100
      marginCount += 1
    }
    if ((p.onHandQty ?? 0) < (p.parLevel ?? 0)) belowPar += 1
    const cat = catMap.get(p.category) ?? { valuePence: 0, count: 0 }
    cat.valuePence += value
    cat.count += 1
    catMap.set(p.category, cat)
  }

  const topValue = [...products]
    .map((p) => ({ name: p.name, valuePence: Math.round((p.onHandQty ?? 0) * (p.costPricePence ?? 0)) }))
    .sort((a, b) => b.valuePence - a.valuePence)
    .slice(0, 6)

  const [lastCompleted] = await db
    .select({ variance: stockCount.varianceValuePence })
    .from(stockCount)
    .where(
      and(
        eq(stockCount.userId, userId),
        eq(stockCount.venueId, venueId),
        eq(stockCount.status, "Completed"),
      ),
    )
    .orderBy(desc(stockCount.completedAt))
    .limit(1)

  return {
    productCount: products.length,
    stockValuePence: stockValue,
    retailValuePence: retailValue,
    potentialProfitPence: retailValue - stockValue,
    avgMarginPct: marginCount > 0 ? marginSum / marginCount : 0,
    belowParCount: belowPar,
    categories: [...catMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.valuePence - a.valuePence),
    topValue,
    lastVariancePence: lastCompleted ? lastCompleted.variance : null,
  }
}

/* -------------------------------- Helpers --------------------------------- */

function intOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : fallback
}

function numOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}
