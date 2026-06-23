import { getMyLeaveRequests } from "@/app/actions/staff"
import { LeaveView } from "@/components/portal/leave-view"

export default async function PortalLeavePage() {
  const leave = await getMyLeaveRequests()
  return <LeaveView initialLeave={leave} />
}
