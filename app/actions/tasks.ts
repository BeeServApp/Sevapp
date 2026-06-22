"use server"

import { revalidatePath } from "next/cache"
import { and, asc, desc, eq, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { taskCheck, taskCheckItem, correctiveAction, staffMember } from "@/lib/db/schema"
import { getUserId, getAccountId, getCurrentUser } from "@/lib/session"
import { weekStartOf } from "@/lib/rota"

export type TaskWithItems = typeof taskCheck.$inferSelect & {
  items: (typeof taskCheckItem.$inferSelect)[]
}

// ── Recurrence helpers ───────────────────────────────────────────────────────

/** Local YYYY-MM-DD for a date (avoids UTC drift). */
function localISO(d = new Date()): string {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

/** The due date of the current period for a recurrence frequency. */
function currentPeriodDate(frequency: string): string {
  if (frequency === "Weekly") return weekStartOf()
  if (frequency === "Monthly") {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  }
  // Daily (and any other cadence) resolves to today.
  return localISO()
}

export async function getTaskChecks(venueId: number) {
  const userId = await getAccountId()
  // Keep recurring instances current whenever the board is viewed.
  await generateRecurringTaskInstances(venueId)
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
  assigneeStaffId?: number | null
  assigneeRole?: string | null
  dueDate?: string
  dueTime?: string
  frequency: string
  priority: string
  requiresPhoto: boolean
  recurring?: boolean
  notes?: string
  items: string[]
}

export async function createTaskCheck(input: CreateTaskInput) {
  const userId = await getUserId()
  // Recurring tasks become templates that spawn dated instances on demand.
  const isRecurring = !!input.recurring && input.frequency !== "One-off"
  const [created] = await db
    .insert(taskCheck)
    .values({
      userId,
      venueId: input.venueId,
      title: input.title,
      category: input.category,
      assignee: input.assignee || null,
      assigneeStaffId: input.assigneeStaffId ?? null,
      assigneeRole: input.assigneeRole || null,
      dueDate: input.dueDate || null,
      dueTime: input.dueTime || null,
      frequency: input.frequency,
      priority: input.priority,
      requiresPhoto: input.requiresPhoto,
      recurring: isRecurring,
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

  // Spawn the first instance immediately so it shows up as actionable today.
  if (isRecurring) {
    await generateRecurringTaskInstances(input.venueId)
  }

  revalidatePath("/tasks")
  revalidatePath("/staff")
  return created
}

/**
 * Ensures each recurring template has a task instance for the current period.
 * Idempotent: safe to call on every page load. Copies the template's checklist
 * items onto each new instance so completion history is per-period.
 */
export async function generateRecurringTaskInstances(venueId: number) {
  const accountId = await getAccountId()
  const templates = await db
    .select()
    .from(taskCheck)
    .where(
      and(
        eq(taskCheck.userId, accountId),
        eq(taskCheck.venueId, venueId),
        eq(taskCheck.recurring, true),
      ),
    )

  for (const t of templates) {
    const periodDate = currentPeriodDate(t.frequency)
    if (t.lastGeneratedDate === periodDate) continue

    const [existing] = await db
      .select({ id: taskCheck.id })
      .from(taskCheck)
      .where(and(eq(taskCheck.recurrenceParentId, t.id), eq(taskCheck.dueDate, periodDate)))
      .limit(1)

    if (!existing) {
      const [inst] = await db
        .insert(taskCheck)
        .values({
          userId: accountId,
          venueId: t.venueId,
          title: t.title,
          category: t.category,
          assignee: t.assignee,
          assigneeStaffId: t.assigneeStaffId,
          assigneeRole: t.assigneeRole,
          dueDate: periodDate,
          dueTime: t.dueTime,
          frequency: t.frequency,
          priority: t.priority,
          requiresPhoto: t.requiresPhoto,
          recurring: false,
          recurrenceParentId: t.id,
          status: "Pending",
          notes: t.notes,
        })
        .returning()

      const tmplItems = await db
        .select()
        .from(taskCheckItem)
        .where(eq(taskCheckItem.taskId, t.id))
        .orderBy(asc(taskCheckItem.sortOrder))

      if (tmplItems.length > 0) {
        await db.insert(taskCheckItem).values(
          tmplItems.map((it) => ({
            userId: accountId,
            taskId: inst.id,
            label: it.label,
            sortOrder: it.sortOrder,
          })),
        )
      }
    }

    await db
      .update(taskCheck)
      .set({ lastGeneratedDate: periodDate })
      .where(eq(taskCheck.id, t.id))
  }
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
  // Remove this task's items, and if it's a template, its generated instances too.
  await db.delete(taskCheckItem).where(and(eq(taskCheckItem.taskId, taskId), eq(taskCheckItem.userId, userId)))
  const instances = await db
    .select({ id: taskCheck.id })
    .from(taskCheck)
    .where(and(eq(taskCheck.recurrenceParentId, taskId), eq(taskCheck.userId, userId)))
  for (const inst of instances) {
    await db.delete(taskCheckItem).where(and(eq(taskCheckItem.taskId, inst.id), eq(taskCheckItem.userId, userId)))
  }
  await db.delete(taskCheck).where(and(eq(taskCheck.recurrenceParentId, taskId), eq(taskCheck.userId, userId)))
  await db.delete(taskCheck).where(and(eq(taskCheck.id, taskId), eq(taskCheck.userId, userId)))
  revalidatePath("/tasks")
  revalidatePath("/staff")
}

// ── Staff-facing task actions ────────────────────────────────────────────────

/**
 * Tasks assigned to the signed-in staff member — either directly (assigneeStaffId)
 * or via their role (assigneeRole). Returns dated instances and one-off tasks
 * (never templates), newest due first, with checklist items attached.
 */
export async function getMyTasks(): Promise<TaskWithItems[]> {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return []

  const [m] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  if (!m) return []

  // Make sure the current period's recurring instances exist before reading.
  await generateRecurringTaskInstances(m.venueId)

  const rows = await db
    .select()
    .from(taskCheck)
    .where(
      and(
        eq(taskCheck.userId, me.accountId),
        eq(taskCheck.venueId, m.venueId),
        eq(taskCheck.recurring, false),
        or(eq(taskCheck.assigneeStaffId, m.id), eq(taskCheck.assigneeRole, m.role)),
      ),
    )
    .orderBy(asc(taskCheck.dueDate), desc(taskCheck.createdAt))

  if (rows.length === 0) return []

  const items = await db.select().from(taskCheckItem).where(eq(taskCheckItem.userId, me.accountId))

  return rows.map((t) => ({
    ...t,
    items: items.filter((i) => i.taskId === t.id).sort((a, b) => a.sortOrder - b.sortOrder),
  }))
}

/** Verify a task belongs to the staff's account and is assigned to them. */
async function assertAssignedToMe(taskId: number) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) throw new Error("Not a staff account")
  const [m] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  if (!m) throw new Error("Staff record not found")
  const [task] = await db
    .select()
    .from(taskCheck)
    .where(and(eq(taskCheck.id, taskId), eq(taskCheck.userId, me.accountId)))
    .limit(1)
  if (!task) throw new Error("Task not found")
  const mine = task.assigneeStaffId === m.id || (task.assigneeRole && task.assigneeRole === m.role)
  if (!mine) throw new Error("This task is not assigned to you")
  return { me, member: m, task }
}

export async function staffToggleTaskItem(itemId: number, done: boolean) {
  const me = await getCurrentUser()
  // Item must belong to the owner's account; ownership of the parent task is
  // implied because staff only ever see their own assigned task ids.
  await db
    .update(taskCheckItem)
    .set({ done })
    .where(and(eq(taskCheckItem.id, itemId), eq(taskCheckItem.userId, me.accountId)))
  revalidatePath("/staff")
}

export async function staffUpdateTaskStatus(input: { taskId: number; status: string; photoUrl?: string }) {
  const { me } = await assertAssignedToMe(input.taskId)
  await db
    .update(taskCheck)
    .set({
      status: input.status,
      completedBy: input.status === "Completed" ? me.name : null,
      completedAt: input.status === "Completed" ? new Date() : null,
      photoUrl: input.photoUrl ?? undefined,
    })
    .where(and(eq(taskCheck.id, input.taskId), eq(taskCheck.userId, me.accountId)))
  revalidatePath("/staff")
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
