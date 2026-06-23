"use server"

import { db } from "@/lib/db"
import {
  staffMember,
  rotaShift,
  clockEvent,
  takings,
  schedulingSettings,
  availability,
  shiftSwap,
  timecard,
  tipEntry,
} from "@/lib/db/schema"
import { getAccountId, getCurrentUser, requireOwner } from "@/lib/session"
import { emitChange } from "@/lib/realtime"
import { notify } from "@/app/actions/notifications"
import { and, asc, desc, eq, gte, lte } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { ROTA_DAYS, dayLabelOf, addWeeks } from "@/lib/rota"

// ── Scheduling settings ───────────────────────────────────────────────────────

export async function getSchedulingSettings() {
  const accountId = await getAccountId()
  const [row] = await db
    .select()
    .from(schedulingSettings)
    .where(eq(schedulingSettings.userId, accountId))
    .limit(1)
  if (row) return row
  const [created] = await db
    .insert(schedulingSettings)
    .values({ userId: accountId })
    .returning()
  return created
}

export async function updateSchedulingSettings(data: {
  overtimeWeeklyHours?: number
  overtimeDailyHours?: number
  clockInGraceMins?: number
  warnUnscheduled?: boolean
  tipPooling?: boolean
}) {
  const me = await requireOwner()
  await getSchedulingSettings() // ensure a row exists
  const [updated] = await db
    .update(schedulingSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schedulingSettings.userId, me.accountId))
    .returning()
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return updated
}

// ── Availability ──────────────────────────────────────────────────────────────

export async function getAvailability(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(availability)
    .where(and(eq(availability.userId, accountId), eq(availability.venueId, venueId)))
    .orderBy(asc(availability.staffMemberId))
}

export async function getMyAvailability() {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return []
  return db
    .select()
    .from(availability)
    .where(and(eq(availability.userId, me.accountId), eq(availability.staffMemberId, me.staffMemberId)))
}

/** Upsert one day's availability for a staff member (owner or the staff themself). */
export async function setAvailability(input: {
  venueId: number
  staffMemberId: number
  day: string
  status: "available" | "unavailable" | "preferred"
  startTime?: string | null
  endTime?: string | null
  note?: string | null
}) {
  const me = await getCurrentUser()
  // Staff may only edit their own availability.
  if (me.appRole !== "owner" && me.staffMemberId !== input.staffMemberId) {
    throw new Error("Not allowed")
  }

  const [existing] = await db
    .select()
    .from(availability)
    .where(
      and(
        eq(availability.userId, me.accountId),
        eq(availability.staffMemberId, input.staffMemberId),
        eq(availability.day, input.day),
      ),
    )
    .limit(1)

  const values = {
    status: input.status,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    note: input.note ?? null,
  }

  let saved
  if (existing) {
    ;[saved] = await db
      .update(availability)
      .set(values)
      .where(eq(availability.id, existing.id))
      .returning()
  } else {
    ;[saved] = await db
      .insert(availability)
      .values({
        userId: me.accountId,
        venueId: input.venueId,
        staffMemberId: input.staffMemberId,
        day: input.day,
        ...values,
      })
      .returning()
  }
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return saved
}

// ── Open-shift claims & swaps ─────────────────────────────────────────────────

export async function getSwaps(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(shiftSwap)
    .where(and(eq(shiftSwap.userId, accountId), eq(shiftSwap.venueId, venueId)))
    .orderBy(desc(shiftSwap.createdAt))
}

export async function getMySwaps() {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return []
  return db
    .select()
    .from(shiftSwap)
    .where(and(eq(shiftSwap.userId, me.accountId), eq(shiftSwap.requesterStaffId, me.staffMemberId)))
    .orderBy(desc(shiftSwap.createdAt))
}

/** Staff claims an open shift — creates a pending claim for the owner to approve. */
export async function requestClaim(shiftId: number) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) throw new Error("Not a staff account")
  const [shift] = await db
    .select()
    .from(rotaShift)
    .where(and(eq(rotaShift.id, shiftId), eq(rotaShift.userId, me.accountId)))
    .limit(1)
  if (!shift) throw new Error("Shift not found")
  if (shift.staffMemberId !== 0) throw new Error("Shift is not open")

  const [created] = await db
    .insert(shiftSwap)
    .values({
      userId: me.accountId,
      venueId: shift.venueId,
      shiftId,
      requesterStaffId: me.staffMemberId,
      targetStaffId: null,
      type: "claim",
      status: "pending",
    })
    .returning()

  // Notify the owner.
  await notify({
    accountId: me.accountId,
    recipientUserId: me.accountId,
    staffMemberId: me.staffMemberId,
    kind: "swap",
    title: "Open shift claimed",
    body: `${me.name} wants the open ${shift.day} shift (${shift.startTime ?? ""}-${shift.endTime ?? ""}).`,
    href: "/staff",
  })
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return created
}

/** Staff requests to drop or swap one of their own shifts. */
export async function requestSwap(input: {
  shiftId: number
  type: "drop" | "swap"
  targetStaffId?: number | null
  note?: string | null
}) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) throw new Error("Not a staff account")
  const [shift] = await db
    .select()
    .from(rotaShift)
    .where(and(eq(rotaShift.id, input.shiftId), eq(rotaShift.userId, me.accountId)))
    .limit(1)
  if (!shift) throw new Error("Shift not found")
  if (shift.staffMemberId !== me.staffMemberId) throw new Error("Not your shift")

  const [created] = await db
    .insert(shiftSwap)
    .values({
      userId: me.accountId,
      venueId: shift.venueId,
      shiftId: input.shiftId,
      requesterStaffId: me.staffMemberId,
      targetStaffId: input.targetStaffId ?? null,
      type: input.type,
      status: "pending",
      note: input.note ?? null,
    })
    .returning()

  await notify({
    accountId: me.accountId,
    recipientUserId: me.accountId,
    staffMemberId: me.staffMemberId,
    kind: "swap",
    title: input.type === "drop" ? "Shift drop requested" : "Shift swap requested",
    body: `${me.name} — ${shift.day} ${shift.startTime ?? ""}-${shift.endTime ?? ""}`,
    href: "/staff",
  })
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return created
}

/** Owner approves/declines a swap/claim/drop. Approving reassigns the shift. */
export async function resolveSwap(swapId: number, decision: "approved" | "declined") {
  const me = await requireOwner()
  const [swap] = await db
    .select()
    .from(shiftSwap)
    .where(and(eq(shiftSwap.id, swapId), eq(shiftSwap.userId, me.accountId)))
    .limit(1)
  if (!swap) throw new Error("Request not found")

  await db
    .update(shiftSwap)
    .set({ status: decision })
    .where(eq(shiftSwap.id, swapId))

  if (decision === "approved") {
    // Determine the new assignee for the shift.
    let newStaffId: number | null = null
    if (swap.type === "claim") newStaffId = swap.requesterStaffId
    else if (swap.type === "swap") newStaffId = swap.targetStaffId ?? 0
    else if (swap.type === "drop") newStaffId = 0 // back to the open pool

    if (newStaffId !== null) {
      const [updated] = await db
        .update(rotaShift)
        .set({ staffMemberId: newStaffId })
        .where(and(eq(rotaShift.id, swap.shiftId), eq(rotaShift.userId, me.accountId)))
        .returning()

      if (newStaffId > 0) {
        const [m] = await db
          .select()
          .from(staffMember)
          .where(and(eq(staffMember.id, newStaffId), eq(staffMember.userId, me.accountId)))
          .limit(1)
        if (m?.linkedUserId) {
          await notify({
            accountId: me.accountId,
            recipientUserId: m.linkedUserId,
            staffMemberId: m.id,
            kind: "shift",
            title: "Shift assigned to you",
            body: `${updated.day} ${updated.startTime ?? ""}-${updated.endTime ?? ""}`,
            href: "/staff",
            email: m.email,
          })
        }
      }
    }
  }

  // Notify the requester of the outcome.
  const [requester] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, swap.requesterStaffId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  if (requester?.linkedUserId) {
    await notify({
      accountId: me.accountId,
      recipientUserId: requester.linkedUserId,
      staffMemberId: requester.id,
      kind: "swap",
      title: `Request ${decision}`,
      body: decision === "approved" ? "Your shift request was approved." : "Your shift request was declined.",
      href: "/staff",
      email: requester.email,
    })
  }

  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return { ok: true }
}

// ── Week duplication ──────────────────────────────────────────────────────────

/** Copy every shift from one week into another (defaults to the previous week). */
export async function copyRota(venueId: number, toWeekStart: string, fromWeekStart?: string) {
  const me = await requireOwner()
  const source = fromWeekStart ?? addWeeks(toWeekStart, -1)

  const sourceShifts = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.venueId, venueId),
        eq(rotaShift.weekStart, source),
      ),
    )
  if (sourceShifts.length === 0) return { copied: 0 }

  await db.insert(rotaShift).values(
    sourceShifts.map((s) => ({
      userId: me.accountId,
      venueId,
      staffMemberId: s.staffMemberId,
      weekStart: toWeekStart,
      day: s.day,
      shiftTime: s.shiftTime,
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
  return { copied: sourceShifts.length }
}

// ── Timecards ─────────────────────────────────────────────────────────────────

export async function getTimecards(venueId: number, fromISO: string, toISO: string) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(timecard)
    .where(
      and(
        eq(timecard.userId, accountId),
        eq(timecard.venueId, venueId),
        gte(timecard.dateISO, fromISO),
        lte(timecard.dateISO, toISO),
      ),
    )
    .orderBy(desc(timecard.dateISO))
}

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(d)
}
function isoDate(d: Date): string {
  // yyyy-mm-dd in Europe/London
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/London",
  }).format(d)
  return parts
}

/**
 * Generate timecards from raw clock events in a date range by pairing each
 * in→out per staff member per day. Skips days that already have a timecard.
 */
export async function generateTimecards(venueId: number, fromISO: string, toISO: string) {
  const me = await requireOwner()
  const events = await db
    .select()
    .from(clockEvent)
    .where(and(eq(clockEvent.userId, me.accountId), eq(clockEvent.venueId, venueId)))
    .orderBy(asc(clockEvent.createdAt))

  const members = await db
    .select()
    .from(staffMember)
    .where(eq(staffMember.userId, me.accountId))
  const rateById = new Map(members.map((m) => [m.id, m.defaultPayRatePence ?? 0]))

  const existing = await db
    .select()
    .from(timecard)
    .where(
      and(
        eq(timecard.userId, me.accountId),
        eq(timecard.venueId, venueId),
        gte(timecard.dateISO, fromISO),
        lte(timecard.dateISO, toISO),
      ),
    )
  const existingKeys = new Set(existing.map((t) => `${t.staffMemberId}|${t.dateISO}`))

  // Group events by staff + date, then pair in/out sequentially.
  const groups = new Map<string, { staffMemberId: number; staffName: string; dateISO: string; events: typeof events }>()
  for (const e of events) {
    const date = isoDate(new Date(e.createdAt))
    if (date < fromISO || date > toISO) continue
    const key = `${e.staffMemberId}|${date}`
    if (!groups.has(key)) {
      groups.set(key, { staffMemberId: e.staffMemberId, staffName: e.staffName, dateISO: date, events: [] as typeof events })
    }
    groups.get(key)!.events.push(e)
  }

  const toInsert: (typeof timecard.$inferInsert)[] = []
  for (const g of groups.values()) {
    if (existingKeys.has(`${g.staffMemberId}|${g.dateISO}`)) continue
    let pendingIn: Date | null = null
    for (const e of g.events) {
      if (e.type === "in") {
        pendingIn = new Date(e.createdAt)
      } else if (e.type === "out" && pendingIn) {
        toInsert.push({
          userId: me.accountId,
          venueId,
          staffMemberId: g.staffMemberId,
          staffName: g.staffName,
          dateISO: g.dateISO,
          clockIn: hhmm(pendingIn),
          clockOut: hhmm(new Date(e.createdAt)),
          breakMins: 0,
          payRatePence: rateById.get(g.staffMemberId) ?? 0,
          status: "open",
          source: "clock",
        })
        pendingIn = null
      }
    }
    // Open (still clocked in) — record clock-in with no out.
    if (pendingIn) {
      toInsert.push({
        userId: me.accountId,
        venueId,
        staffMemberId: g.staffMemberId,
        staffName: g.staffName,
        dateISO: g.dateISO,
        clockIn: hhmm(pendingIn),
        clockOut: null,
        breakMins: 0,
        payRatePence: rateById.get(g.staffMemberId) ?? 0,
        status: "open",
        source: "clock",
      })
    }
  }

  if (toInsert.length > 0) await db.insert(timecard).values(toInsert)
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return { created: toInsert.length }
}

export async function upsertTimecard(input: {
  id?: number
  venueId: number
  staffMemberId: number
  staffName: string
  dateISO: string
  clockIn?: string | null
  clockOut?: string | null
  breakMins?: number
  payRatePence?: number
  status?: string
}) {
  const me = await requireOwner()
  const values = {
    staffMemberId: input.staffMemberId,
    staffName: input.staffName,
    dateISO: input.dateISO,
    clockIn: input.clockIn ?? null,
    clockOut: input.clockOut ?? null,
    breakMins: input.breakMins ?? 0,
    payRatePence: input.payRatePence ?? 0,
    status: input.status ?? "open",
  }
  let saved
  if (input.id) {
    ;[saved] = await db
      .update(timecard)
      .set(values)
      .where(and(eq(timecard.id, input.id), eq(timecard.userId, me.accountId)))
      .returning()
  } else {
    ;[saved] = await db
      .insert(timecard)
      .values({ userId: me.accountId, venueId: input.venueId, source: "manual", ...values })
      .returning()
  }
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return saved
}

export async function deleteTimecard(id: number) {
  const me = await requireOwner()
  await db.delete(timecard).where(and(eq(timecard.id, id), eq(timecard.userId, me.accountId)))
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
}

export async function approveAllTimecards(venueId: number, fromISO: string, toISO: string) {
  const me = await requireOwner()
  await db
    .update(timecard)
    .set({ status: "approved" })
    .where(
      and(
        eq(timecard.userId, me.accountId),
        eq(timecard.venueId, venueId),
        gte(timecard.dateISO, fromISO),
        lte(timecard.dateISO, toISO),
      ),
    )
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
}

/** The logged-in staff member's own approved/open timecards in a range. */
export async function getMyTimecards(fromISO: string, toISO: string) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return []
  return db
    .select()
    .from(timecard)
    .where(
      and(
        eq(timecard.userId, me.accountId),
        eq(timecard.staffMemberId, me.staffMemberId),
        gte(timecard.dateISO, fromISO),
        lte(timecard.dateISO, toISO),
      ),
    )
    .orderBy(desc(timecard.dateISO))
}

// ── Tips ────────────────────────────────────────────────────────────────────

export async function getTips(venueId: number, fromISO: string, toISO: string) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(tipEntry)
    .where(
      and(
        eq(tipEntry.userId, accountId),
        eq(tipEntry.venueId, venueId),
        gte(tipEntry.dateISO, fromISO),
        lte(tipEntry.dateISO, toISO),
      ),
    )
    .orderBy(desc(tipEntry.dateISO))
}

export async function addTip(input: {
  venueId: number
  dateISO: string
  staffMemberId?: number | null
  amountPence: number
  method: "cash" | "card"
  pooled: boolean
  note?: string | null
}) {
  const me = await requireOwner()
  const [created] = await db
    .insert(tipEntry)
    .values({
      userId: me.accountId,
      venueId: input.venueId,
      dateISO: input.dateISO,
      staffMemberId: input.pooled ? null : (input.staffMemberId ?? null),
      amountPence: input.amountPence,
      method: input.method,
      pooled: input.pooled,
      note: input.note ?? null,
    })
    .returning()
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return created
}

export async function deleteTip(id: number) {
  const me = await requireOwner()
  await db.delete(tipEntry).where(and(eq(tipEntry.id, id), eq(tipEntry.userId, me.accountId)))
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
}

// ── Reporting (labour vs sales) ───────────────────────────────────────────────

/** Daily takings rows for the 7 days of a week, keyed by day label (Mon..Sun). */
export async function getWeekSales(venueId: number, weekStart: string) {
  const accountId = await getAccountId()
  const end = addWeeks(weekStart, 1)
  const rows = await db
    .select()
    .from(takings)
    .where(
      and(
        eq(takings.userId, accountId),
        eq(takings.venueId, venueId),
        gte(takings.dateISO, weekStart),
        lte(takings.dateISO, end),
      ),
    )
  const byDay: Record<string, number> = {}
  for (const d of ROTA_DAYS) byDay[d] = 0
  for (const r of rows) {
    const total = (r.wetPence ?? 0) + (r.foodPence ?? 0) + (r.eventsPence ?? 0) + (r.retailPence ?? 0)
    const day = dayLabelOf(r.dateISO)
    if (day in byDay) byDay[day] += total
  }
  return byDay
}
