import type { Metadata } from "next"
import { getActiveVenueId, getCurrentUser } from "@/lib/session"
import {
  getStaffMembers,
  getLeaveRequests,
  getRotaShifts,
  getClockEvents,
  getStaffInviteStatuses,
} from "@/app/actions/staff"
import {
  getSchedulingSettings,
  getAvailability,
  getSwaps,
  getTimecards,
  getTips,
  getWeekSales,
} from "@/app/actions/scheduling"
import {
  generatePatternShifts,
  getShiftPatterns,
  getRotaTemplates,
  getShiftTasks,
  getCrossLocationConflicts,
} from "@/app/actions/shift-planning"
import { getHomeData, getRotaData } from "@/app/actions/portal"
import { getMyProfile, getMyLeaveRequests } from "@/app/actions/staff"
import { getMyAvailability, getMyTimecards } from "@/app/actions/scheduling"
import { ROTA_DAYS, weekStartOf, addWeeks, dateForDay } from "@/lib/rota"
import { StaffView } from "@/components/staff-view"
import { StaffPortalView } from "@/components/staff-portal-view"

export const metadata: Metadata = {
  title: "Staff & Scheduling — Tapsheet",
}

function normalizeWeek(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return weekStartOf(new Date(`${raw}T00:00:00`))
  return weekStartOf()
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const me = await getCurrentUser()
  const sp = await searchParams
  const weekStart = normalizeWeek(sp.week)
  const weekEnd = addWeeks(weekStart, 1)

  // ── Staff: self-service view (their own shifts, timecards, availability) ────
  if (me.appRole === "staff") {
    const [home, rota, timecards, profile, availability, leave] = await Promise.all([
      getHomeData(weekStart),
      getRotaData(weekStart),
      getMyTimecards(weekStart, dateForDay(weekStart, "Sun")),
      getMyProfile(),
      getMyAvailability(),
      getMyLeaveRequests(),
    ])
    return (
      <StaffPortalView
        home={home}
        rota={rota}
        timecards={timecards}
        leave={leave}
        weekStart={weekStart}
        me={{
          name: me.name,
          email: me.email,
          role: profile?.role ?? null,
          venueId: profile?.venueId ?? 0,
          staffMemberId: me.staffMemberId,
        }}
        availability={availability}
        rotaDays={[...ROTA_DAYS]}
      />
    )
  }

  // ── Owner: full scheduling management console ───────────────────────────────
  const venueId = await getActiveVenueId(me.accountId)

  if (!venueId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>No venue found. Create a venue first.</p>
      </div>
    )
  }

  // Materialise any recurring-pattern shifts that fall on this week before we read.
  await generatePatternShifts(venueId, weekStart)

  const [
    staffMembers,
    leaveRequests,
    rotaShifts,
    clockEvents,
    inviteStatuses,
    settings,
    availabilityRows,
    swaps,
    timecards,
    tips,
    weekSales,
    patterns,
    templates,
    conflicts,
  ] = await Promise.all([
    getStaffMembers(venueId),
    getLeaveRequests(venueId),
    getRotaShifts(venueId, weekStart),
    getClockEvents(venueId),
    getStaffInviteStatuses(venueId),
    getSchedulingSettings(),
    getAvailability(venueId),
    getSwaps(venueId),
    getTimecards(venueId, weekStart, weekEnd),
    getTips(venueId, weekStart, weekEnd),
    getWeekSales(venueId, weekStart),
    getShiftPatterns(venueId),
    getRotaTemplates(venueId),
    getCrossLocationConflicts(venueId, weekStart),
  ])

  const shiftTasks = await getShiftTasks(rotaShifts.map((s) => s.id))

  return (
    <StaffView
      venueId={venueId}
      initialStaff={staffMembers}
      initialLeave={leaveRequests}
      initialShifts={rotaShifts}
      initialClockEvents={clockEvents}
      initialInviteStatuses={inviteStatuses}
      initialAvailability={availabilityRows}
      initialSwaps={swaps}
      initialTimecards={timecards}
      initialTips={tips}
      settings={settings}
      weekSales={weekSales}
      initialPatterns={patterns}
      initialTemplates={templates}
      initialShiftTasks={shiftTasks}
      initialConflicts={conflicts}
      weekStart={weekStart}
      rotaDays={[...ROTA_DAYS]}
    />
  )
}
