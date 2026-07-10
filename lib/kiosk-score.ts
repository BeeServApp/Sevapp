import "server-only"

import { db } from "@/lib/db"
import { clockEvent, rotaShift, schedulingSettings } from "@/lib/db/schema"
import { and, eq, gte } from "drizzle-orm"
import { dayLabelOf, weekStartOf } from "@/lib/rota"
import { getVenueTasksForDate, localISO, type VenueTask } from "@/lib/kiosk-tasks"

/**
 * Venue score (0–100) shown on the kiosk. Two weighted components:
 *  - Tasks (60): today's tasks completed on time. Late completions earn half
 *    credit; still-overdue tasks earn none. Not-yet-due tasks get benefit of doubt.
 *  - Punctuality (40): rostered staff clocking in/out on time vs the published
 *    rota, within the account's clock-in grace window.
 */

export interface VenueScore {
  score: number
  taskScore: number
  punctualityScore: number
  tasksTotal: number
  tasksCompleted: number
  tasksLate: number
  tasksOverdue: number
  shiftsTotal: number
  lateClockIns: number
  missedClockIns: number
  missedClockOuts: number
}

export interface AlertState {
  alert: boolean
  reasons: string[]
}

const TASK_WEIGHT = 60
const PUNCTUALITY_WEIGHT = 40

function atTime(dateISO: string, hhmm: string): Date | null {
  const [y, m, d] = dateISO.split("-").map(Number)
  const [hh, mm] = (hhmm || "").split(":").map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

async function getGraceMins(accountId: string): Promise<number> {
  const [s] = await db
    .select({ grace: schedulingSettings.clockInGraceMins })
    .from(schedulingSettings)
    .where(eq(schedulingSettings.userId, accountId))
    .limit(1)
  return s?.grace ?? 5
}

/** Today's published shifts (assigned only) for a venue. */
async function getTodaysShifts(accountId: string, venueId: number, dateISO: string) {
  const weekStart = weekStartOf(new Date(`${dateISO}T12:00:00`))
  const dayLabel = dayLabelOf(dateISO)
  const shifts = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, accountId),
        eq(rotaShift.venueId, venueId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.day, dayLabel),
        eq(rotaShift.status, "published"),
      ),
    )
  return shifts.filter((s) => s.staffMemberId && s.startTime)
}

/** Today's clock events for a venue, grouped by staff member. */
async function getTodaysClockByStaff(accountId: string, venueId: number, dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  const rows = await db
    .select()
    .from(clockEvent)
    .where(and(eq(clockEvent.userId, accountId), eq(clockEvent.venueId, venueId), gte(clockEvent.createdAt, start)))

  const byStaff = new Map<number, { firstIn: Date | null; lastOut: Date | null }>()
  for (const e of rows) {
    const cur = byStaff.get(e.staffMemberId) ?? { firstIn: null, lastOut: null }
    if (e.type === "in" && (!cur.firstIn || e.createdAt < cur.firstIn)) cur.firstIn = e.createdAt
    if (e.type === "out" && (!cur.lastOut || e.createdAt > cur.lastOut)) cur.lastOut = e.createdAt
    byStaff.set(e.staffMemberId, cur)
  }
  return byStaff
}

function scoreTasks(tasks: VenueTask[], now: Date) {
  if (tasks.length === 0) {
    return { taskScore: TASK_WEIGHT, tasksTotal: 0, tasksCompleted: 0, tasksLate: 0, tasksOverdue: 0 }
  }
  let credit = 0
  let completed = 0
  let late = 0
  let overdue = 0
  for (const t of tasks) {
    const dueAt = t.dueDate && t.dueTime ? atTime(t.dueDate, t.dueTime) : null
    const isCompleted = t.status === "Completed"
    if (isCompleted) {
      completed++
      const wasLate = dueAt && t.completedAt ? t.completedAt > dueAt : false
      if (wasLate) {
        late++
        credit += 0.5
      } else {
        credit += 1
      }
    } else if (dueAt && now > dueAt) {
      overdue++ // past due and not done — no credit
    } else {
      credit += 1 // not yet due — benefit of the doubt
    }
  }
  return {
    taskScore: Math.round((credit / tasks.length) * TASK_WEIGHT),
    tasksTotal: tasks.length,
    tasksCompleted: completed,
    tasksLate: late,
    tasksOverdue: overdue,
  }
}

/** Compute the full venue score with breakdown. */
export async function computeVenueScore(accountId: string, venueId: number, dateISO = localISO()): Promise<VenueScore> {
  const now = new Date()
  const grace = await getGraceMins(accountId)
  const graceMs = grace * 60000

  const tasks = await getVenueTasksForDate(accountId, venueId, dateISO)
  const t = scoreTasks(tasks, now)

  const shifts = await getTodaysShifts(accountId, venueId, dateISO)
  const clock = await getTodaysClockByStaff(accountId, venueId, dateISO)

  let checkpoints = 0
  let good = 0
  let lateClockIns = 0
  let missedClockIns = 0
  let missedClockOuts = 0

  for (const s of shifts) {
    const startAt = s.startTime ? atTime(dateISO, s.startTime) : null
    const endAt = s.endTime ? atTime(dateISO, s.endTime) : null
    const punches = clock.get(s.staffMemberId)

    // Clock-in checkpoint (only evaluated once the shift start has passed).
    if (startAt && now >= startAt) {
      checkpoints++
      if (punches?.firstIn) {
        if (punches.firstIn.getTime() <= startAt.getTime() + graceMs) good++
        else lateClockIns++
      } else {
        missedClockIns++
      }
    }
    // Clock-out checkpoint (only once the shift end + grace has passed).
    if (endAt && now.getTime() > endAt.getTime() + graceMs) {
      checkpoints++
      if (punches?.lastOut) good++
      else missedClockOuts++
    }
  }

  const punctualityScore = checkpoints === 0 ? PUNCTUALITY_WEIGHT : Math.round((good / checkpoints) * PUNCTUALITY_WEIGHT)

  return {
    score: t.taskScore + punctualityScore,
    taskScore: t.taskScore,
    punctualityScore,
    tasksTotal: t.tasksTotal,
    tasksCompleted: t.tasksCompleted,
    tasksLate: t.tasksLate,
    tasksOverdue: t.tasksOverdue,
    shiftsTotal: shifts.length,
    lateClockIns,
    missedClockIns,
    missedClockOuts,
  }
}

/** Whether the kiosk should be flashing red, and why. */
export async function computeAlertState(accountId: string, venueId: number, dateISO = localISO()): Promise<AlertState> {
  const now = new Date()
  const grace = await getGraceMins(accountId)
  const graceMs = grace * 60000
  const reasons: string[] = []

  // Overdue tasks.
  const tasks = await getVenueTasksForDate(accountId, venueId, dateISO)
  const overdue = tasks.filter((t) => {
    if (t.status === "Completed") return false
    const dueAt = t.dueDate && t.dueTime ? atTime(t.dueDate, t.dueTime) : null
    return dueAt ? now > dueAt : false
  })
  if (overdue.length > 0) {
    reasons.push(`${overdue.length} task${overdue.length > 1 ? "s" : ""} overdue`)
  }

  // Clock punctuality.
  const shifts = await getTodaysShifts(accountId, venueId, dateISO)
  const clock = await getTodaysClockByStaff(accountId, venueId, dateISO)
  let missedIn = 0
  let missedOut = 0
  for (const s of shifts) {
    const startAt = s.startTime ? atTime(dateISO, s.startTime) : null
    const endAt = s.endTime ? atTime(dateISO, s.endTime) : null
    const punches = clock.get(s.staffMemberId)
    if (startAt && now.getTime() > startAt.getTime() + graceMs && !punches?.firstIn) missedIn++
    if (endAt && now.getTime() > endAt.getTime() + graceMs && !punches?.lastOut) missedOut++
  }
  if (missedIn > 0) reasons.push(`${missedIn} staff not clocked in`)
  if (missedOut > 0) reasons.push(`${missedOut} staff not clocked out`)

  return { alert: reasons.length > 0, reasons }
}
