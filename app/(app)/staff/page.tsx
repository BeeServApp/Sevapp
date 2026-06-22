import type { Metadata } from "next"
import { getActiveVenueId, getCurrentUser } from "@/lib/session"
import {
  getStaffMembers,
  getLeaveRequests,
  getRotaShifts,
  getClockEvents,
  getStaffInviteStatuses,
  getMyShifts,
} from "@/app/actions/staff"
import { StaffView } from "@/components/staff-view"
import { StaffPortal } from "@/components/staff/staff-portal"

export const metadata: Metadata = {
  title: "Staff & Scheduling — Tapsheet",
}

const ROTA_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function currentWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  return mon.toISOString().slice(0, 10)
}

export default async function StaffPage() {
  const me = await getCurrentUser()
  const weekStart = currentWeekStart()

  // ── Staff portal: focused, personal view of their own schedule ──────────────
  if (me.appRole === "staff") {
    const myShifts = await getMyShifts(weekStart)
    return (
      <StaffPortal
        name={me.name}
        weekStart={weekStart}
        rotaDays={ROTA_DAYS}
        initialShifts={myShifts}
        staffMemberId={me.staffMemberId}
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

  const [staffMembers, leaveRequests, rotaShifts, clockEvents, inviteStatuses] = await Promise.all([
    getStaffMembers(venueId),
    getLeaveRequests(venueId),
    getRotaShifts(venueId, weekStart),
    getClockEvents(venueId),
    getStaffInviteStatuses(venueId),
  ])

  return (
    <StaffView
      venueId={venueId}
      initialStaff={staffMembers}
      initialLeave={leaveRequests}
      initialShifts={rotaShifts}
      initialClockEvents={clockEvents}
      initialInviteStatuses={inviteStatuses}
      weekStart={weekStart}
      rotaDays={ROTA_DAYS}
    />
  )
}
