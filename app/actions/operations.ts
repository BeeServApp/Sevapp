"use server"

import { db } from "@/lib/db"
import { maintenance, order, supplier, task, venueEvent } from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const OPS_PATH = "/operations"

/* --------------------------------- Orders --------------------------------- */

export async function getOrders(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(order)
    .where(and(eq(order.userId, userId), eq(order.venueId, venueId)))
    .orderBy(desc(order.id))
}

export async function createOrder(data: {
  venueId: number
  reference: string
  supplier: string
  items: number
  totalPence: number
  status: string
  due?: string
}) {
  const userId = await getUserId()
  const reference = data.reference.trim()
  const supplierName = data.supplier.trim()
  if (!reference) throw new Error("Order reference is required")
  if (!supplierName) throw new Error("Supplier is required")

  const [created] = await db
    .insert(order)
    .values({
      userId,
      venueId: data.venueId,
      reference,
      supplier: supplierName,
      items: Number.isFinite(data.items) ? data.items : 0,
      totalPence: Number.isFinite(data.totalPence) ? data.totalPence : 0,
      status: data.status || "Draft",
      due: data.due?.trim() || "—",
    })
    .returning()

  revalidatePath(OPS_PATH)
  return created
}

export async function updateOrderStatus(id: number, status: string) {
  const userId = await getUserId()
  await db
    .update(order)
    .set({ status })
    .where(and(eq(order.id, id), eq(order.userId, userId)))
  revalidatePath(OPS_PATH)
}

export async function deleteOrder(id: number) {
  const userId = await getUserId()
  await db.delete(order).where(and(eq(order.id, id), eq(order.userId, userId)))
  revalidatePath(OPS_PATH)
}

/* ------------------------------- Suppliers -------------------------------- */

export async function getSuppliers(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(supplier)
    .where(and(eq(supplier.userId, userId), eq(supplier.venueId, venueId)))
    .orderBy(asc(supplier.name))
}

export async function createSupplier(data: {
  venueId: number
  name: string
  category?: string
  terms: string
  spendMtdPence: number
  rating: string
}) {
  const userId = await getUserId()
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
      spendMtdPence: Number.isFinite(data.spendMtdPence) ? data.spendMtdPence : 0,
      rating: data.rating || "4.5",
    })
    .returning()

  revalidatePath(OPS_PATH)
  return created
}

export async function updateSupplier(
  id: number,
  data: { name: string; category?: string; terms: string; spendMtdPence: number; rating: string },
) {
  const userId = await getUserId()
  await db
    .update(supplier)
    .set({
      name: data.name.trim(),
      category: data.category?.trim() || null,
      terms: data.terms,
      spendMtdPence: Number.isFinite(data.spendMtdPence) ? data.spendMtdPence : 0,
      rating: data.rating,
    })
    .where(and(eq(supplier.id, id), eq(supplier.userId, userId)))
  revalidatePath(OPS_PATH)
}

export async function deleteSupplier(id: number) {
  const userId = await getUserId()
  await db.delete(supplier).where(and(eq(supplier.id, id), eq(supplier.userId, userId)))
  revalidatePath(OPS_PATH)
}

/* ------------------------------ Maintenance ------------------------------- */

export async function getMaintenance(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(maintenance)
    .where(and(eq(maintenance.userId, userId), eq(maintenance.venueId, venueId)))
    .orderBy(desc(maintenance.id))
}

export async function createMaintenance(data: {
  venueId: number
  assetName: string
  issue?: string
  priority: string
  assignee?: string
  status: string
}) {
  const userId = await getUserId()
  const assetName = data.assetName.trim()
  if (!assetName) throw new Error("Asset is required")

  const [created] = await db
    .insert(maintenance)
    .values({
      userId,
      venueId: data.venueId,
      assetName,
      issue: data.issue?.trim() || null,
      priority: data.priority || "Medium",
      assignee: data.assignee?.trim() || null,
      status: data.status || "Open",
    })
    .returning()

  revalidatePath(OPS_PATH)
  return created
}

export async function updateMaintenanceStatus(id: number, status: string) {
  const userId = await getUserId()
  await db
    .update(maintenance)
    .set({ status })
    .where(and(eq(maintenance.id, id), eq(maintenance.userId, userId)))
  revalidatePath(OPS_PATH)
}

export async function deleteMaintenance(id: number) {
  const userId = await getUserId()
  await db.delete(maintenance).where(and(eq(maintenance.id, id), eq(maintenance.userId, userId)))
  revalidatePath(OPS_PATH)
}

/* --------------------------------- Events --------------------------------- */

export async function getEvents(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(venueEvent)
    .where(and(eq(venueEvent.userId, userId), eq(venueEvent.venueId, venueId)))
    .orderBy(desc(venueEvent.id))
}

export async function createEvent(data: {
  venueId: number
  name: string
  date?: string
  covers: number
  status: string
  owner?: string
}) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Event name is required")

  const [created] = await db
    .insert(venueEvent)
    .values({
      userId,
      venueId: data.venueId,
      name,
      date: data.date?.trim() || null,
      covers: Number.isFinite(data.covers) ? data.covers : 0,
      status: data.status || "Provisional",
      owner: data.owner?.trim() || null,
    })
    .returning()

  revalidatePath(OPS_PATH)
  return created
}

export async function updateEventStatus(id: number, status: string) {
  const userId = await getUserId()
  await db
    .update(venueEvent)
    .set({ status })
    .where(and(eq(venueEvent.id, id), eq(venueEvent.userId, userId)))
  revalidatePath(OPS_PATH)
}

export async function deleteEvent(id: number) {
  const userId = await getUserId()
  await db.delete(venueEvent).where(and(eq(venueEvent.id, id), eq(venueEvent.userId, userId)))
  revalidatePath(OPS_PATH)
}

/* --------------------------------- Tasks ---------------------------------- */

export async function getTasks(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(task)
    .where(and(eq(task.userId, userId), eq(task.venueId, venueId)))
    .orderBy(asc(task.done), desc(task.id))
}

export async function createTask(data: {
  venueId: number
  title: string
  area?: string
  assignee?: string
  due?: string
  priority: string
}) {
  const userId = await getUserId()
  const title = data.title.trim()
  if (!title) throw new Error("Task title is required")

  const [created] = await db
    .insert(task)
    .values({
      userId,
      venueId: data.venueId,
      title,
      area: data.area?.trim() || null,
      assignee: data.assignee?.trim() || null,
      due: data.due?.trim() || null,
      priority: data.priority || "Medium",
      done: false,
    })
    .returning()

  revalidatePath(OPS_PATH)
  return created
}

export async function toggleTask(id: number, done: boolean) {
  const userId = await getUserId()
  await db
    .update(task)
    .set({ done })
    .where(and(eq(task.id, id), eq(task.userId, userId)))
  revalidatePath(OPS_PATH)
}

export async function deleteTask(id: number) {
  const userId = await getUserId()
  await db.delete(task).where(and(eq(task.id, id), eq(task.userId, userId)))
  revalidatePath(OPS_PATH)
}
