"use server"

import { db } from "@/lib/db"
import { rotaShift, staffMember, clockEvent, tipEntry, takings, venue, timecard, shiftSwap } from "@/lib/db/schema"
import type { DbShiftSwap } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { and, asc, desc, eq, gte, lte } from "drizzle-orm"
import { addWeeks, dateForDay, dayLabelOf, shiftHours, weekStartOf } from "@/lib/rota"

const DAY_ORDER: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

export interface WeekStats {
  hoursScheduled: number
  hoursWorked: number
  tipsPence: number
  estimatedEarningsPence: number
  commissionsPence: number
}

export interface NextShiftInfo {
  dateISO: string
  relLabel: string
  day: string
  startTime: string | null
  endTime: string | null
  role: string | null
  venueName: string
}

export interface HomeData {
  firstName: string
  venueName: string
  weekStart: string
  clockState: "in" | "out"
  nextShift: NextShiftInfo | null
  stats: WeekStats
}

export interface TeamShift {
  id: number
  day: string
  dateISO: string
  startTime: string | null
  endTime: string | null
  shiftTime: string | null
  breakMins: number
  role: string | null
  color: string | null
  staffMemberId: number
  staffName: string
  isMe: boolean
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date())
}

function relativeLabel(dateISO: string): string {
  const today = todayISO()
  if (dateISO === today) return "Today"
  const t = new Date(`${today}T00:00:00`)
  t.setDate(t.getDate() + 1)
  const tomorrowISO = t.toISOString().slice(0, 10)
  if (dateISO === tomorrowISO) return "Tomorrow"
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" })
}

/** Empty stats used for non-staff or unlinked accounts. */
function emptyStats(): WeekStats {
  return { hoursScheduled: 0, hoursWorked: 0, tipsPence: 0, estimatedEarningsPence: 0, commissionsPence: 0 }
}

/**
 * Everything the staff Home tab needs: next shift, clock state, and the
 * computed "My week" figures (hours, tips, estimated pay, commission).
 */
export async function getHomeData(weekStartRaw?: string): Promise<HomeData> {
  const me = await getCurrentUser()
  const firstName = me.name.split(" ")[0] ?? me.name
  const weekStart = weekStartRaw && /^\d{4}-\d{2}-\d{2}$/.test(weekStartRaw) ? weekStartRaw : weekStartOf()

  if (me.staffMemberId == null) {
    return { firstName, venueName: "", weekStart, clockState: "out", nextShift: null, stats: emptyStats() }
  }

  const [profile] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)

  if (!profile) {
    return { firstName, venueName: "", weekStart, clockState: "out", nextShift: null, stats: emptyStats() }
  }

  const [v] = await db
    .select({ name: venue.name })
    .from(venue)
    .where(eq(venue.id, profile.venueId))
    .limit(1)
  const venueName = v?.name ?? ""

  const stats = await computeWeekStats(me.accountId, me.staffMemberId, profile, weekStart)

  // Clock state: latest clock event for this staff member.
  const [lastEvent] = await db
    .select({ type: clockEvent.type })
    .from(clockEvent)
    .where(and(eq(clockEvent.userId, me.accountId), eq(clockEvent.staffMemberId, me.staffMemberId)))
    .orderBy(desc(clockEvent.createdAt))
    .limit(1)
  const clockState: "in" | "out" = lastEvent?.type === "in" ? "in" : "out"

  // Next shift: earliest published shift today or later across this & next week.
  const today = todayISO()
  const nextWeek = addWeeks(weekStartOf(), 1)
  const upcoming = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.staffMemberId, me.staffMemberId),
        eq(rotaShift.status, "published"),
      ),
    )
  const candidates = upcoming
    .filter((s) => s.weekStart === weekStartOf() || s.weekStart === nextWeek)
    .map((s) => ({ s, dateISO: dateForDay(s.weekStart, s.day) }))
    .filter((x) => x.dateISO >= today)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))

  const nextShift: NextShiftInfo | null = candidates[0]
    ? {
        dateISO: candidates[0].dateISO,
        relLabel: relativeLabel(candidates[0].dateISO),
        day: candidates[0].s.day,
        startTime: candidates[0].s.startTime,
        endTime: candidates[0].s.endTime,
        role: candidates[0].s.role,
        venueName,
      }
    : null

  return { firstName, venueName, weekStart, clockState, nextShift, stats }
}

/** Compute the weekly figures for a single staff member. */
async function computeWeekStats(
  accountId: string,
  staffMemberId: number,
  profile: typeof staffMember.$inferSelect,
  weekStart: string,
): Promise<WeekStats> {
  const weekEndISO = dateForDay(weekStart, "Sun")

  // All published shifts in the venue this week (for team apportioning + tips).
  const allShifts = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, accountId),
        eq(rotaShift.venueId, profile.venueId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.status, "published"),
      ),
    )

  const myShifts = allShifts.filter((s) => s.staffMemberId === staffMemberId)

  let hoursScheduled = 0
  let estimatedEarningsPence = 0
  for (const s of myShifts) {
    const h = shiftHours(s.startTime, s.endTime, s.breakMins)
    hoursScheduled += h
    const rate = s.payRatePence > 0 ? s.payRatePence : profile.defaultPayRatePence
    estimatedEarningsPence += h * rate
  }

  // Hours worked from the staff member's own timecards in the range.
  const myTimecards = await db
    .select()
    .from(timecard)
    .where(
      and(
        eq(timecard.userId, accountId),
        eq(timecard.staffMemberId, staffMemberId),
        gte(timecard.dateISO, weekStart),
        lte(timecard.dateISO, weekEndISO),
      ),
    )
  let hoursWorked = 0
  for (const t of myTimecards) {
    if (t.clockIn && t.clockOut) hoursWorked += shiftHours(t.clockIn, t.clockOut, t.breakMins)
  }

  // Workers per day-label (who has a published shift that day) for pooled tips.
  const workersByDay = new Map<string, Set<number>>()
  for (const s of allShifts) {
    if (s.staffMemberId <= 0) continue
    if (!workersByDay.has(s.day)) workersByDay.set(s.day, new Set())
    workersByDay.get(s.day)!.add(s.staffMemberId)
  }

  // Tips: individual entries assigned to me + an equal share of pooled tips.
  const tips = await db
    .select()
    .from(tipEntry)
    .where(
      and(
        eq(tipEntry.userId, accountId),
        eq(tipEntry.venueId, profile.venueId),
        gte(tipEntry.dateISO, weekStart),
        lte(tipEntry.dateISO, weekEndISO),
      ),
    )
  let tipsPence = 0
  for (const tip of tips) {
    if (tip.pooled || tip.staffMemberId == null) {
      const day = dayLabelOf(tip.dateISO)
      const workers = workersByDay.get(day)
      if (workers && workers.has(staffMemberId) && workers.size > 0) {
        tipsPence += tip.amountPence / workers.size
      }
    } else if (tip.staffMemberId === staffMemberId) {
      tipsPence += tip.amountPence
    }
  }

  // Commission: percent of the staff member's apportioned share of week sales,
  // weighted by their scheduled hours vs the whole team's scheduled hours.
  let commissionsPence = 0
  if (profile.commissionPct > 0) {
    let teamHours = 0
    for (const s of allShifts) {
      if (s.staffMemberId > 0) teamHours += shiftHours(s.startTime, s.endTime, s.breakMins)
    }
    if (teamHours > 0 && hoursScheduled > 0) {
      const salesRows = await db
        .select()
        .from(takings)
        .where(
          and(
            eq(takings.userId, accountId),
            eq(takings.venueId, profile.venueId),
            gte(takings.dateISO, weekStart),
            lte(takings.dateISO, weekEndISO),
          ),
        )
      let weekSales = 0
      for (const r of salesRows) {
        weekSales += (r.wetPence ?? 0) + (r.foodPence ?? 0) + (r.eventsPence ?? 0) + (r.retailPence ?? 0)
      }
      const myShare = hoursScheduled / teamHours
      commissionsPence = (profile.commissionPct / 100) * weekSales * myShare
    }
  }

  return {
    hoursScheduled,
    hoursWorked,
    tipsPence: Math.round(tipsPence),
    estimatedEarningsPence: Math.round(estimatedEarningsPence),
    commissionsPence: Math.round(commissionsPence),
  }
}

/**
 * Published, assigned team shifts for the staff member's venue in a week,
 * grouped-ready and flagged with which ones are the current user's.
 */
export async function getTeamWeekShifts(weekStartRaw?: string): Promise<{ venueName: string; shifts: TeamShift[] }> {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return { venueName: "", shifts: [] }

  const [profile] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  if (!profile) return { venueName: "", shifts: [] }

  const weekStart = weekStartRaw && /^\d{4}-\d{2}-\d{2}$/.test(weekStartRaw) ? weekStartRaw : weekStartOf()

  const [v] = await db
    .select({ name: venue.name })
    .from(venue)
    .where(eq(venue.id, profile.venueId))
    .limit(1)

  const members = await db
    .select({ id: staffMember.id, name: staffMember.name })
    .from(staffMember)
    .where(eq(staffMember.userId, me.accountId))
  const nameById = new Map(members.map((m) => [m.id, m.name]))

  const rows = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.venueId, profile.venueId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.status, "published"),
      ),
    )
    .orderBy(asc(rotaShift.id))

  const shifts: TeamShift[] = rows
    .filter((s) => s.staffMemberId > 0)
    .map((s) => ({
      id: s.id,
      day: s.day,
      dateISO: dateForDay(weekStart, s.day),
      startTime: s.startTime,
      endTime: s.endTime,
      shiftTime: s.shiftTime,
      breakMins: s.breakMins,
      role: s.role,
      color: s.color,
      staffMemberId: s.staffMemberId,
      staffName: nameById.get(s.staffMemberId) ?? "Team member",
      isMe: s.staffMemberId === me.staffMemberId,
    }))
    .sort((a, b) => {
      const d = (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9)
      if (d !== 0) return d
      return (a.startTime ?? "").localeCompare(b.startTime ?? "")
    })

  return { venueName: v?.name ?? "", shifts }
}

export interface OpenShift {
  id: number
  day: string
  dateISO: string
  startTime: string | null
  endTime: string | null
  shiftTime: string | null
  breakMins: number
  role: string | null
  color: string | null
}

export interface RotaData {
  venueName: string
  weekStart: string
  myStaffMemberId: number | null
  shifts: TeamShift[]
  openShifts: OpenShift[]
  mySwaps: DbShiftSwap[]
  teammates: { id: number; name: string }[]
}

/**
 * Everything the staff Rota tab needs in one round trip: published team shifts,
 * unassigned open shifts staff can claim, the staff member's own pending swap/
 * drop/claim requests, and the list of teammates available as swap targets.
 */
export async function getRotaData(weekStartRaw?: string): Promise<RotaData> {
  const me = await getCurrentUser()
  const weekStart = weekStartRaw && /^\d{4}-\d{2}-\d{2}$/.test(weekStartRaw) ? weekStartRaw : weekStartOf()
  const empty: RotaData = {
    venueName: "",
    weekStart,
    myStaffMemberId: me.staffMemberId,
    shifts: [],
    openShifts: [],
    mySwaps: [],
    teammates: [],
  }
  if (me.staffMemberId == null) return empty

  const [profile] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  if (!profile) return empty

  const [v] = await db
    .select({ name: venue.name })
    .from(venue)
    .where(eq(venue.id, profile.venueId))
    .limit(1)

  const members = await db
    .select({ id: staffMember.id, name: staffMember.name })
    .from(staffMember)
    .where(and(eq(staffMember.userId, me.accountId), eq(staffMember.venueId, profile.venueId)))
  const nameById = new Map(members.map((m) => [m.id, m.name]))

  const rows = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.venueId, profile.venueId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.status, "published"),
      ),
    )
    .orderBy(asc(rotaShift.id))

  const byDayThenStart = (a: { day: string; startTime: string | null }, b: { day: string; startTime: string | null }) => {
    const d = (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9)
    if (d !== 0) return d
    return (a.startTime ?? "").localeCompare(b.startTime ?? "")
  }

  const shifts: TeamShift[] = rows
    .filter((s) => s.staffMemberId > 0)
    .map((s) => ({
      id: s.id,
      day: s.day,
      dateISO: dateForDay(weekStart, s.day),
      startTime: s.startTime,
      endTime: s.endTime,
      shiftTime: s.shiftTime,
      breakMins: s.breakMins,
      role: s.role,
      color: s.color,
      staffMemberId: s.staffMemberId,
      staffName: nameById.get(s.staffMemberId) ?? "Team member",
      isMe: s.staffMemberId === me.staffMemberId,
    }))
    .sort(byDayThenStart)

  const openShifts: OpenShift[] = rows
    .filter((s) => s.staffMemberId === 0)
    .map((s) => ({
      id: s.id,
      day: s.day,
      dateISO: dateForDay(weekStart, s.day),
      startTime: s.startTime,
      endTime: s.endTime,
      shiftTime: s.shiftTime,
      breakMins: s.breakMins,
      role: s.role,
      color: s.color,
    }))
    .sort(byDayThenStart)

  const mySwaps: DbShiftSwap[] = await db
    .select()
    .from(shiftSwap)
    .where(and(eq(shiftSwap.userId, me.accountId), eq(shiftSwap.requesterStaffId, me.staffMemberId)))
    .orderBy(desc(shiftSwap.createdAt))

  const teammates = members
    .filter((m) => m.id !== me.staffMemberId)
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    venueName: v?.name ?? "",
    weekStart,
    myStaffMemberId: me.staffMemberId,
    shifts,
    openShifts,
    mySwaps,
    teammates,
  }
}
