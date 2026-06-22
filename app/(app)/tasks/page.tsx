import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { TasksView } from "@/components/tasks-view"
import { getActiveVenueId, getSession } from "@/lib/session"
import { getTaskChecks, getCorrectiveActions } from "@/app/actions/tasks"

export const metadata: Metadata = {
  title: "Task Management — Beeserv",
}

export default async function TasksPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start managing tasks.
      </p>
    )
  }

  const [tasks, actions] = await Promise.all([
    getTaskChecks(venueId),
    getCorrectiveActions(venueId),
  ])

  return <TasksView venueId={venueId} initialTasks={tasks} initialActions={actions} />
}
