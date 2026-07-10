import "server-only"

import { db } from "@/lib/db"
import { taskCheck, taskCheckItem } from "@/lib/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { dayLabelOf, weekStartOf } from "@/lib/rota"

/**
 * Kiosk-side task helpers. These mirror the tasks board's recurrence semantics
 * but take an explicit `accountId` (the kiosk has no Better Auth session, so it
 * cannot use the session-scoped generator in app/actions/tasks.ts).
 */

export interface VenueTask {
  id: number
  title: string
  category: string
  dueDate: string | null
  dueTime: string | null
  priority: string
  status: string
  requiresPhoto: boolean
  completedBy: string | null
  completedAt: Date | null
}

/** Local YYYY-MM-DD (avoids UTC drift). */
export function localISO(d = new Date()): string {
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
  return localISO()
}

/**
 * Ensures each recurring template for the venue has an instance for the current
 * period. Idempotent — safe to call on every kiosk poll. Mirrors
 * generateRecurringTaskInstances but scoped by explicit accountId.
 */
export async function ensureVenueTaskInstances(accountId: string, venueId: number) {
  const templates = await db
    .select()
    .from(taskCheck)
    .where(and(eq(taskCheck.userId, accountId), eq(taskCheck.venueId, venueId), eq(taskCheck.recurring, true)))

  for (const t of templates) {
    const periodDate = currentPeriodDate(t.frequency)
    if (t.frequency === "Set days") {
      const days = (t.repeatDays ?? "").split(",").map((s) => s.trim()).filter(Boolean)
      if (!days.includes(dayLabelOf(periodDate))) continue
    }
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
          assignOnShift: t.assignOnShift,
          dueDate: periodDate,
          dueTime: t.dueTime,
          frequency: t.frequency,
          repeatDays: t.repeatDays,
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
          tmplItems.map((it) => ({ userId: accountId, taskId: inst.id, label: it.label, sortOrder: it.sortOrder })),
        )
      }
    }

    await db.update(taskCheck).set({ lastGeneratedDate: periodDate }).where(eq(taskCheck.id, t.id))
  }
}

/** All real (non-template) tasks for a venue due on the given date. */
export async function getVenueTasksForDate(
  accountId: string,
  venueId: number,
  dateISO: string,
): Promise<VenueTask[]> {
  await ensureVenueTaskInstances(accountId, venueId)
  const rows = await db
    .select()
    .from(taskCheck)
    .where(and(eq(taskCheck.userId, accountId), eq(taskCheck.venueId, venueId)))

  return rows
    .filter((r) => !r.recurring && r.dueDate === dateISO)
    .map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      dueDate: r.dueDate,
      dueTime: r.dueTime,
      priority: r.priority,
      status: r.status,
      requiresPhoto: r.requiresPhoto,
      completedBy: r.completedBy,
      completedAt: r.completedAt,
    }))
    .sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"))
}
