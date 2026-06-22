import type { Metadata } from "next"
import { getActiveVenueId, getCurrentUser } from "@/lib/session"
import {
  getStaffMembers,
  getLeaveRequests,
  getRotaShifts,
  getClockEvents,
  getStaffInviteStatuses,
  getMyShifts,
  getMyProfile,
} from "@/app/actions/staff"
import {
  getSchedulingSettings,
  getAvailability,
  getMyAvailability,
  getSwaps,
  getMySwaps,
  getTimecards,
  getMyTimecards,
  getTips,
  getWeekSales,
} from "@/app/actions/scheduling"
import { ROTA_DAYS, weekStartOf, addWeeks } from "@/lib/rota"
import { StaffView } from "@/components/staff-view"
import { StaffPortal } from "@/components/staff/staff-portal"

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

  // ── Staff portal: focused, personal view of their own schedule ──────────────
  if (me.appRole === "staff") {
    const [profile, myShifts, myAvailability, mySwaps, myTimecards] = await Promise.all([
      getMyProfile(),
      getMyShifts(weekStart),
      getMyAvailability(),
      getMySwaps(),
      getMyTimecards(weekStart, weekEnd),
    ])
    return (
      <StaffPortal
        name={me.name}
        weekStart={weekStart}
        rotaDays={[...ROTA_DAYS]}
        initialShifts={myShifts}
        initialAvailability={myAvailability}
        initialSwaps={mySwaps}
        initialTimecards={myTimecards}
        staffMemberId={me.staffMemberId}
        venueId={profile?.venueId ?? 0}
      />
    )
  }

  // ── Owner: full scheduling management ───────────────────────────────────────
  const venueId = await getActiveVenueId(me.accountId)

  if (!venueId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>No venue found. Create a venue first.</p>
      </div>
    )
  }

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
  ])

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
      weekStart={weekStart}
      rotaDays={[...ROTA_DAYS]}
    />
  )
}
