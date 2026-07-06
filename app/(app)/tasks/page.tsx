import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { TasksView } from "@/components/tasks-view"
import { getActiveVenueId, getCurrentUser, getSession } from "@/lib/session"
import { guardModuleAccess } from "@/lib/plan-guard"
import { getTaskChecks, getCorrectiveActions } from "@/app/actions/tasks"
import { getStaffMembers } from "@/app/actions/staff"
import { getMeetings, getMeterReadings, getDocuments } from "@/app/actions/oversight"

export const metadata: Metadata = {
  title: "Task Management — Beeserv",
}

export default async function TasksPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  await guardModuleAccess("/tasks")

  // Meter Readings are restricted to owners and area managers.
  const me = await getCurrentUser()
  const canViewMeters = me.appRole === "owner" || me.managerRole === "area_manager"

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start managing tasks.
      </p>
    )
  }

  const [tasks, actions, staff, meetings, meterReadings, documents] = await Promise.all([
    getTaskChecks(venueId),
    getCorrectiveActions(venueId),
    getStaffMembers(venueId),
    getMeetings(venueId),
    getMeterReadings(venueId),
    getDocuments(venueId),
  ])

  return (
    <Suspense>
      <TasksView
        venueId={venueId}
        initialTasks={tasks}
        initialActions={actions}
        staff={staff}
        initialMeetings={meetings}
        initialMeterReadings={meterReadings}
        canViewMeters={canViewMeters}
        initialDocuments={documents}
      />
    </Suspense>
  )
}
