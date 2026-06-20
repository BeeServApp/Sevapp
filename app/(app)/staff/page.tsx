import type { Metadata } from "next"
import { getUserId, getActiveVenueId } from "@/lib/session"
import {
  getStaffMembers,
  getLeaveRequests,
  getRotaShifts,
  getClockEvents,
} from "@/app/actions/staff"
import { StaffView } from "@/components/staff-view"

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
  const userId = await getUserId()
  const venueId = await getActiveVenueId(userId)

  if (!venueId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>No venue found. Create a venue first.</p>
      </div>
    )
  }

  const weekStart = currentWeekStart()

  const [staffMembers, leaveRequests, rotaShifts, clockEvents] = await Promise.all([
    getStaffMembers(venueId),
    getLeaveRequests(venueId),
    getRotaShifts(venueId, weekStart),
    getClockEvents(venueId),
  ])

  return (
    <StaffView
      venueId={venueId}
      initialStaff={staffMembers}
      initialLeave={leaveRequests}
      initialShifts={rotaShifts}
      initialClockEvents={clockEvents}
      weekStart={weekStart}
      rotaDays={ROTA_DAYS}
    />
  )
}
