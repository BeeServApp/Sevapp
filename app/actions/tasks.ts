"use server"

import { revalidatePath } from "next/cache"
import { and, asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { taskCheck, taskCheckItem, correctiveAction } from "@/lib/db/schema"
import { getUserId } from "@/lib/session"

export type TaskWithItems = typeof taskCheck.$inferSelect & {
  items: (typeof taskCheckItem.$inferSelect)[]
}

export async function getTaskChecks(venueId: number) {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(taskCheck)
    .where(and(eq(taskCheck.userId, userId), eq(taskCheck.venueId, venueId)))
    .orderBy(desc(taskCheck.createdAt))

  const items = await db
    .select()
    .from(taskCheckItem)
    .where(eq(taskCheckItem.userId, userId))
    .orderBy(asc(taskCheckItem.sortOrder))

  return rows.map((t) => ({
    ...t,
    items: items.filter((i) => i.taskId === t.id),
  })) satisfies TaskWithItems[]
}

export async function getCorrectiveActions(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(correctiveAction)
    .where(and(eq(correctiveAction.userId, userId), eq(correctiveAction.venueId, venueId)))
    .orderBy(desc(correctiveAction.createdAt))
}

type CreateTaskInput = {
  venueId: number
  title: string
  category: string
  assignee?: string
  dueDate?: string
  dueTime?: string
  frequency: string
  priority: string
  requiresPhoto: boolean
  notes?: string
  items: string[]
}

export async function createTaskCheck(input: CreateTaskInput) {
  const userId = await getUserId()
  const [created] = await db
    .insert(taskCheck)
    .values({
      userId,
      venueId: input.venueId,
      title: input.title,
      category: input.category,
      assignee: input.assignee || null,
      dueDate: input.dueDate || null,
      dueTime: input.dueTime || null,
      frequency: input.frequency,
      priority: input.priority,
      requiresPhoto: input.requiresPhoto,
      notes: input.notes || null,
    })
    .returning()

  const cleanItems = input.items.map((s) => s.trim()).filter(Boolean)
  if (cleanItems.length > 0) {
    await db.insert(taskCheckItem).values(
      cleanItems.map((label, idx) => ({
        userId,
        taskId: created.id,
        label,
        sortOrder: idx,
      })),
    )
  }

  revalidatePath("/tasks")
  return created
}

export async function toggleTaskItem(itemId: number, done: boolean) {
  const userId = await getUserId()
  await db
    .update(taskCheckItem)
    .set({ done })
    .where(and(eq(taskCheckItem.id, itemId), eq(taskCheckItem.userId, userId)))
  revalidatePath("/tasks")
}

export async function updateTaskStatus(input: {
  taskId: number
  status: string
  completedBy?: string
  photoUrl?: string
}) {
  const userId = await getUserId()
  await db
    .update(taskCheck)
    .set({
      status: input.status,
      completedBy: input.status === "Completed" ? input.completedBy || null : null,
      completedAt: input.status === "Completed" ? new Date() : null,
      photoUrl: input.photoUrl ?? undefined,
    })
    .where(and(eq(taskCheck.id, input.taskId), eq(taskCheck.userId, userId)))
  revalidatePath("/tasks")
}

export async function deleteTaskCheck(taskId: number) {
  const userId = await getUserId()
  await db.delete(taskCheckItem).where(and(eq(taskCheckItem.taskId, taskId), eq(taskCheckItem.userId, userId)))
  await db.delete(taskCheck).where(and(eq(taskCheck.id, taskId), eq(taskCheck.userId, userId)))
  revalidatePath("/tasks")
}

export async function createCorrectiveAction(input: {
  venueId: number
  title: string
  description?: string
  sourceTaskId?: number
  priority: string
  assignee?: string
  dueDate?: string
  photoUrl?: string
}) {
  const userId = await getUserId()
  const [created] = await db
    .insert(correctiveAction)
    .values({
      userId,
      venueId: input.venueId,
      title: input.title,
      description: input.description || null,
      sourceTaskId: input.sourceTaskId ?? null,
      priority: input.priority,
      assignee: input.assignee || null,
      dueDate: input.dueDate || null,
      photoUrl: input.photoUrl || null,
    })
    .returning()
  revalidatePath("/tasks")
  return created
}

export async function updateCorrectiveActionStatus(actionId: number, status: string) {
  const userId = await getUserId()
  await db
    .update(correctiveAction)
    .set({
      status,
      resolvedAt: status === "Resolved" ? new Date() : null,
    })
    .where(and(eq(correctiveAction.id, actionId), eq(correctiveAction.userId, userId)))
  revalidatePath("/tasks")
}

export async function deleteCorrectiveAction(actionId: number) {
  const userId = await getUserId()
  await db
    .delete(correctiveAction)
    .where(and(eq(correctiveAction.id, actionId), eq(correctiveAction.userId, userId)))
  revalidatePath("/tasks")
}
