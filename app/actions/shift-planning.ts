"use server"

import { db } from "@/lib/db"
import {
  rotaShift,
  shiftPattern,
  rotaTemplate,
  rotaTemplateShift,
  shiftTask,
  staffMember,
  availability,
  leaveRequest,
  schedulingSettings,
} from "@/lib/db/schema"
import { getAccountId, getCurrentUser, requireOwner } from "@/lib/session"
import { emitChange } from "@/lib/realtime"
import { and, asc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { addWeeks, shiftHours, dateForDay } from "@/lib/rota"

// ── Time helpers ──────────────────────────────────────────────────────────────

/** "HH:MM" → minutes since midnight, or null. */
function toMin(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Do two [start,end) time ranges overlap? End-before-start counts as overnight. */
function timesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  const as = toMin(aStart)
  let ae = toMin(aEnd)
  const bs = toMin(bStart)
  let be = toMin(bEnd)
  if (as == null || ae == null || bs == null || be == null) return false
  if (ae <= as) ae += 24 * 60
  if (be <= bs) be += 24 * 60
  return as < be && bs < ae
}

/** Whole-week count between two yyyy-mm-dd Mondays. */
function weeksBetween(fromWeek: string, toWeek: string): number {
  const a = new Date(`${fromWeek}T00:00:00`).getTime()
  const b = new Date(`${toWeek}T00:00:00`).getTime()
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000))
}

// ── Recurring shift patterns ────────────────────────────────────────────────

export async function getShiftPatterns(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(shiftPattern)
    .where(and(eq(shiftPattern.userId, accountId), eq(shiftPattern.venueId, venueId), eq(shiftPattern.active, true)))
    .orderBy(asc(shiftPattern.id))
}

export interface PatternInput {
  venueId: number
  staffMemberId: number
  day: string
  role?: string | null
  startTime?: string | null
  endTime?: string | null
  color?: string | null
  breakMins?: number
  notes?: string | null
  payRatePence?: number
  repeatWeeks: number
  anchorWeek: string
}

/** Create a recurring pattern and immediately generate its first occurrence. */
export async function createShiftPattern(input: PatternInput) {
  const me = await requireOwner()
  const [created] = await db
    .insert(shiftPattern)
    .values({
      userId: me.accountId,
      venueId: input.venueId,
      staffMemberId: input.staffMemberId,
      day: input.day,
      role: input.role ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      color: input.color ?? "green",
      breakMins: input.breakMins ?? 0,
      notes: input.notes ?? null,
      payRatePence: input.payRatePence ?? 0,
      repeatWeeks: Math.max(1, input.repeatWeeks),
      anchorWeek: input.anchorWeek,
    })
    .returning()

  await generatePatternShifts(input.venueId, input.anchorWeek)
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return created
}

/** Stop a pattern from recurring; optionally remove its future draft shifts. */
export async function deleteShiftPattern(patternId: number, removeFutureDrafts = true) {
  const me = await requireOwner()
  await db
    .update(shiftPattern)
    .set({ active: false })
    .where(and(eq(shiftPattern.id, patternId), eq(shiftPattern.userId, me.accountId)))

  if (removeFutureDrafts) {
    // Only unpublished, generated occurrences are safe to remove.
    await db
      .delete(rotaShift)
      .where(
        and(
          eq(rotaShift.userId, me.accountId),
          eq(rotaShift.patternId, patternId),
          eq(rotaShift.status, "draft"),
        ),
      )
  }
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
}

/**
 * Idempotently materialise draft shifts for every active pattern that lands on
 * the given week. Safe to call on each page view.
 */
export async function generatePatternShifts(venueId: number, weekStart: string) {
  const accountId = await getAccountId()
  const patterns = await db
    .select()
    .from(shiftPattern)
    .where(and(eq(shiftPattern.userId, accountId), eq(shiftPattern.venueId, venueId), eq(shiftPattern.active, true)))

  if (patterns.length === 0) return { created: 0 }

  const existing = await db
    .select()
    .from(rotaShift)
    .where(and(eq(rotaShift.userId, accountId), eq(rotaShift.venueId, venueId), eq(rotaShift.weekStart, weekStart)))

  const seenPatternIds = new Set(existing.map((s) => s.patternId).filter((p): p is number => p != null))

  const toInsert: (typeof rotaShift.$inferInsert)[] = []
  for (const p of patterns) {
    const diff = weeksBetween(p.anchorWeek, weekStart)
    if (diff < 0) continue // week is before the pattern starts
    if (diff % Math.max(1, p.repeatWeeks) !== 0) continue // not a recurrence week
    if (seenPatternIds.has(p.id)) continue // already generated

    toInsert.push({
      userId: accountId,
      venueId,
      staffMemberId: p.staffMemberId,
      weekStart,
      day: p.day,
      shiftTime: p.startTime && p.endTime ? `${p.startTime}-${p.endTime}` : null,
      role: p.role,
      startTime: p.startTime,
      endTime: p.endTime,
      color: p.color,
      breakMins: p.breakMins,
      notes: p.notes,
      payRatePence: p.payRatePence,
      status: "draft",
      patternId: p.id,
    })
  }

  if (toInsert.length > 0) {
    await db.insert(rotaShift).values(toInsert)
    await emitChange(accountId, "rota")
  }
  return { created: toInsert.length }
}

// ── Saved rota templates ──────────────────────────────────────────────────────

export async function getRotaTemplates(venueId: number) {
  const accountId = await getAccountId()
  const templates = await db
    .select()
    .from(rotaTemplate)
    .where(and(eq(rotaTemplate.userId, accountId), eq(rotaTemplate.venueId, venueId)))
    .orderBy(asc(rotaTemplate.name))
  if (templates.length === 0) return []

  const shifts = await db
    .select()
    .from(rotaTemplateShift)
    .where(
      and(
        eq(rotaTemplateShift.userId, accountId),
        inArray(
          rotaTemplateShift.templateId,
          templates.map((t) => t.id),
        ),
      ),
    )
  return templates.map((t) => ({
    ...t,
    shiftCount: shifts.filter((s) => s.templateId === t.id).length,
  }))
}

/** Snapshot the current week's shifts into a reusable, named template. */
export async function saveRotaTemplate(venueId: number, weekStart: string, name: string) {
  const me = await requireOwner()
  const weekShifts = await db
    .select()
    .from(rotaShift)
    .where(and(eq(rotaShift.userId, me.accountId), eq(rotaShift.venueId, venueId), eq(rotaShift.weekStart, weekStart)))
  if (weekShifts.length === 0) return { saved: 0, templateId: null as number | null }

  const [tmpl] = await db
    .insert(rotaTemplate)
    .values({ userId: me.accountId, venueId, name: name.trim() || "Untitled template" })
    .returning()

  await db.insert(rotaTemplateShift).values(
    weekShifts.map((s) => ({
      userId: me.accountId,
      templateId: tmpl.id,
      staffMemberId: s.staffMemberId,
      day: s.day,
      role: s.role,
      startTime: s.startTime,
      endTime: s.endTime,
      color: s.color,
      breakMins: s.breakMins,
      notes: s.notes,
      payRatePence: s.payRatePence,
    })),
  )
  revalidatePath("/staff")
  return { saved: weekShifts.length, templateId: tmpl.id }
}

/** Apply a saved template's shifts into a target week as drafts. */
export async function applyRotaTemplate(templateId: number, venueId: number, weekStart: string) {
  const me = await requireOwner()
  const [tmpl] = await db
    .select()
    .from(rotaTemplate)
    .where(and(eq(rotaTemplate.id, templateId), eq(rotaTemplate.userId, me.accountId)))
    .limit(1)
  if (!tmpl) throw new Error("Template not found")

  const tShifts = await db
    .select()
    .from(rotaTemplateShift)
    .where(and(eq(rotaTemplateShift.templateId, templateId), eq(rotaTemplateShift.userId, me.accountId)))
  if (tShifts.length === 0) return { applied: 0 }

  await db.insert(rotaShift).values(
    tShifts.map((s) => ({
      userId: me.accountId,
      venueId,
      staffMemberId: s.staffMemberId,
      weekStart,
      day: s.day,
      shiftTime: s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : null,
      role: s.role,
      startTime: s.startTime,
      endTime: s.endTime,
      color: s.color,
      breakMins: s.breakMins,
      notes: s.notes,
      payRatePence: s.payRatePence,
      status: "draft" as const,
    })),
  )
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return { applied: tShifts.length }
}

export async function deleteRotaTemplate(templateId: number) {
  const me = await requireOwner()
  await db
    .delete(rotaTemplateShift)
    .where(and(eq(rotaTemplateShift.templateId, templateId), eq(rotaTemplateShift.userId, me.accountId)))
  await db.delete(rotaTemplate).where(and(eq(rotaTemplate.id, templateId), eq(rotaTemplate.userId, me.accountId)))
  revalidatePath("/staff")
}

// ── Auto-fill open shifts ─────────────────────────────────────────────────────

/**
 * Assign each open shift to the best available staff member, honouring
 * availability, approved leave, existing overlaps and the weekly overtime cap.
 * Prefers role matches and people who marked the day "preferred".
 */
export async function autoFillOpenShifts(venueId: number, weekStart: string) {
  const me = await requireOwner()

  const [members, weekShifts, avail, leave, settingsRow] = await Promise.all([
    db.select().from(staffMember).where(and(eq(staffMember.userId, me.accountId), eq(staffMember.venueId, venueId))),
    db
      .select()
      .from(rotaShift)
      .where(and(eq(rotaShift.userId, me.accountId), eq(rotaShift.venueId, venueId), eq(rotaShift.weekStart, weekStart))),
    db.select().from(availability).where(and(eq(availability.userId, me.accountId), eq(availability.venueId, venueId))),
    db.select().from(leaveRequest).where(and(eq(leaveRequest.userId, me.accountId), eq(leaveRequest.venueId, venueId))),
    db.select().from(schedulingSettings).where(eq(schedulingSettings.userId, me.accountId)).limit(1),
  ])

  const overtimeLimit = settingsRow[0]?.overtimeWeeklyHours ?? 0
  const availMap = new Map<string, (typeof avail)[number]>()
  for (const a of avail) availMap.set(`${a.staffMemberId}:${a.day}`, a)

  // Running tally of assigned hours per staff member this week.
  const hoursByStaff = new Map<number, number>()
  for (const s of weekShifts) {
    if (s.staffMemberId > 0) {
      hoursByStaff.set(
        s.staffMemberId,
        (hoursByStaff.get(s.staffMemberId) ?? 0) + shiftHours(s.startTime, s.endTime, s.breakMins),
      )
    }
  }

  // Working copy of assignments per staff/day for overlap checks.
  const assignedByStaffDay = new Map<string, { startTime: string | null; endTime: string | null }[]>()
  for (const s of weekShifts) {
    if (s.staffMemberId > 0) {
      const key = `${s.staffMemberId}:${s.day}`
      const list = assignedByStaffDay.get(key) ?? []
      list.push({ startTime: s.startTime, endTime: s.endTime })
      assignedByStaffDay.set(key, list)
    }
  }

  const openShifts = weekShifts.filter((s) => s.staffMemberId === 0)
  let assigned = 0

  for (const open of openShifts) {
    const dur = shiftHours(open.startTime, open.endTime, open.breakMins)
    const dateISO = dateForDay(weekStart, open.day)

    const candidates = members
      .map((m) => {
        const av = availMap.get(`${m.id}:${open.day}`)
        // Hard blocks: explicit unavailability or approved leave on the date.
        if (av?.status === "unavailable") return null
        const onLeave = leave.some(
          (l) => l.staffMemberId === m.id && l.status === "Approved" && l.dates.includes(dateISO),
        )
        if (onLeave) return null
        // No double-booking within the same day.
        const dayShifts = assignedByStaffDay.get(`${m.id}:${open.day}`) ?? []
        if (dayShifts.some((d) => timesOverlap(open.startTime, open.endTime, d.startTime, d.endTime))) return null
        // Respect the weekly overtime cap if one is set.
        const projected = (hoursByStaff.get(m.id) ?? 0) + dur
        if (overtimeLimit > 0 && projected > overtimeLimit) return null

        // Score: prefer role match, then "preferred" availability, then least-loaded.
        let score = 0
        if (open.role && m.role === open.role) score += 100
        if (av?.status === "preferred") score += 50
        score -= hoursByStaff.get(m.id) ?? 0
        return { member: m, score }
      })
      .filter((c): c is { member: (typeof members)[number]; score: number } => c !== null)
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    if (!best) continue

    await db
      .update(rotaShift)
      .set({ staffMemberId: best.member.id })
      .where(and(eq(rotaShift.id, open.id), eq(rotaShift.userId, me.accountId)))

    hoursByStaff.set(best.member.id, (hoursByStaff.get(best.member.id) ?? 0) + dur)
    const key = `${best.member.id}:${open.day}`
    const list = assignedByStaffDay.get(key) ?? []
    list.push({ startTime: open.startTime, endTime: open.endTime })
    assignedByStaffDay.set(key, list)
    assigned++
  }

  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return { assigned, remaining: openShifts.length - assigned }
}

// ── Bulk & reverse actions ────────────────────────────────────────────────────

/** Delete every shift in the week (drafts and published). */
export async function clearWeek(venueId: number, weekStart: string) {
  const me = await requireOwner()
  const rows = await db
    .delete(rotaShift)
    .where(and(eq(rotaShift.userId, me.accountId), eq(rotaShift.venueId, venueId), eq(rotaShift.weekStart, weekStart)))
    .returning({ id: rotaShift.id })
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return { cleared: rows.length }
}

/** Move every assigned shift in the week back to the open pool. */
export async function unassignAllShifts(venueId: number, weekStart: string) {
  const me = await requireOwner()
  const rows = await db
    .update(rotaShift)
    .set({ staffMemberId: 0 })
    .where(and(eq(rotaShift.userId, me.accountId), eq(rotaShift.venueId, venueId), eq(rotaShift.weekStart, weekStart)))
    .returning({ id: rotaShift.id })
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return { unassigned: rows.length }
}

/** Revert a published week back to draft so it can be edited privately. */
export async function unpublishRota(venueId: number, weekStart: string) {
  const me = await requireOwner()
  const rows = await db
    .update(rotaShift)
    .set({ status: "draft" })
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.venueId, venueId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.status, "published"),
      ),
    )
    .returning({ id: rotaShift.id })
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return { unpublished: rows.length }
}

export interface BulkShiftInput {
  venueId: number
  weekStart: string
  staffMemberId: number
  days: string[]
  role?: string | null
  startTime?: string | null
  endTime?: string | null
  color?: string | null
  breakMins?: number
  notes?: string | null
  payRatePence?: number
}

/** Add the same shift to a staff member (or the open pool) across many days. */
export async function bulkAddShifts(input: BulkShiftInput) {
  const me = await requireOwner()
  if (input.days.length === 0) return { added: 0 }
  const shiftTime = input.startTime && input.endTime ? `${input.startTime}-${input.endTime}` : null
  await db.insert(rotaShift).values(
    input.days.map((day) => ({
      userId: me.accountId,
      venueId: input.venueId,
      staffMemberId: input.staffMemberId,
      weekStart: input.weekStart,
      day,
      shiftTime,
      role: input.role ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      color: input.color ?? "green",
      breakMins: input.breakMins ?? 0,
      notes: input.notes ?? null,
      payRatePence: input.payRatePence ?? 0,
      status: "draft" as const,
    })),
  )
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return { added: input.days.length }
}

// ── Shift-attached tasks ──────────────────────────────────────────────────────

export async function getShiftTasks(shiftIds: number[]) {
  if (shiftIds.length === 0) return []
  const accountId = await getAccountId()
  return db
    .select()
    .from(shiftTask)
    .where(and(eq(shiftTask.userId, accountId), inArray(shiftTask.shiftId, shiftIds)))
    .orderBy(asc(shiftTask.sortOrder), asc(shiftTask.id))
}

export async function addShiftTask(shiftId: number, label: string) {
  const me = await requireOwner()
  const clean = label.trim()
  if (!clean) throw new Error("Task label required")
  const existing = await db
    .select({ id: shiftTask.id })
    .from(shiftTask)
    .where(and(eq(shiftTask.userId, me.accountId), eq(shiftTask.shiftId, shiftId)))
  const [created] = await db
    .insert(shiftTask)
    .values({ userId: me.accountId, shiftId, label: clean, sortOrder: existing.length })
    .returning()
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return created
}

export async function deleteShiftTask(id: number) {
  const me = await requireOwner()
  await db.delete(shiftTask).where(and(eq(shiftTask.id, id), eq(shiftTask.userId, me.accountId)))
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
}

/** Staff or owner toggles a shift task's completion. Account-scoped. */
export async function toggleShiftTask(id: number, done: boolean) {
  const me = await getCurrentUser()
  await db
    .update(shiftTask)
    .set({ done })
    .where(and(eq(shiftTask.id, id), eq(shiftTask.userId, me.accountId)))
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
}

/** Shift tasks for the logged-in staff member's own shifts. */
export async function getMyShiftTasks(shiftIds: number[]) {
  if (shiftIds.length === 0) return []
  const me = await getCurrentUser()
  return db
    .select()
    .from(shiftTask)
    .where(and(eq(shiftTask.userId, me.accountId), inArray(shiftTask.shiftId, shiftIds)))
    .orderBy(asc(shiftTask.sortOrder), asc(shiftTask.id))
}

// ── Cross-location conflicts ──────────────────────────────────────────────────

/**
 * For shifts in `venueId`/`weekStart`, find clashes where the same person is
 * also scheduled at a different venue with an overlapping time. People are
 * matched across venues by linked login or shared email. Returns a map of
 * conflicting shiftId → human-readable description.
 */
export async function getCrossLocationConflicts(
  venueId: number,
  weekStart: string,
): Promise<Record<number, string>> {
  const accountId = await getAccountId()

  // All staff for the account, to build a cross-venue identity for each record.
  const members = await db.select().from(staffMember).where(eq(staffMember.userId, accountId))
  const identityOf = (m: (typeof members)[number]) =>
    m.linkedUserId ? `u:${m.linkedUserId}` : m.email ? `e:${m.email.toLowerCase()}` : null
  const memberById = new Map(members.map((m) => [m.id, m]))

  // Every shift across all venues for this week.
  const weekShifts = await db
    .select()
    .from(rotaShift)
    .where(and(eq(rotaShift.userId, accountId), eq(rotaShift.weekStart, weekStart)))

  // Group shifts by identity + day.
  const byIdentityDay = new Map<string, (typeof weekShifts)[number][]>()
  for (const s of weekShifts) {
    if (s.staffMemberId <= 0) continue
    const m = memberById.get(s.staffMemberId)
    if (!m) continue
    const id = identityOf(m)
    if (!id) continue
    const key = `${id}:${s.day}`
    const list = byIdentityDay.get(key) ?? []
    list.push(s)
    byIdentityDay.set(key, list)
  }

  const conflicts: Record<number, string> = {}
  for (const list of byIdentityDay.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (a.venueId === b.venueId) continue
        if (!timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue
        // Flag whichever shift belongs to the venue currently being viewed.
        const other = a.venueId === venueId ? b : a
        const mine = a.venueId === venueId ? a : b
        const otherMember = memberById.get(other.staffMemberId)
        const label = `Also booked at another venue ${other.startTime ?? ""}–${other.endTime ?? ""}${
          otherMember ? ` as ${otherMember.role}` : ""
        }`
        if (mine.venueId === venueId) conflicts[mine.id] = label
        // If neither is the current venue we still record both for completeness.
        if (a.venueId !== venueId && b.venueId !== venueId) {
          conflicts[a.id] = "Double-booked across venues"
          conflicts[b.id] = "Double-booked across venues"
        }
      }
    }
  }
  return conflicts
}
