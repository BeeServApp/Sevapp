import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { OperationsView } from "@/components/operations-view"
import { getActiveVenueId, getSession, guardManagerPage } from "@/lib/session"
import { guardModuleAccess } from "@/lib/plan-guard"
import {
  getEvents,
  getMaintenance,
  getTasks,
} from "@/app/actions/operations"
import { getAssets } from "@/app/actions/assets"

export const metadata: Metadata = {
  title: "Operations — Tapsheet",
}

export default async function OperationsPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  const me = await guardManagerPage()
  await guardModuleAccess("/operations")

  const venueId = await getActiveVenueId(me.accountId)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start managing operations.
      </p>
    )
  }

  const [maintenance, events, tasks, assets] = await Promise.all([
    getMaintenance(venueId),
    getEvents(venueId),
    getTasks(venueId),
    getAssets(venueId),
  ])

  const assetOptions = assets
    .filter((a) => !a.disposalDate)
    .map((a) => ({ id: a.id, assetNumber: a.assetNumber, name: a.name }))

  return (
    <OperationsView
      venueId={venueId}
      maintenance={maintenance}
      events={events}
      tasks={tasks}
      assetOptions={assetOptions}
    />
  )
}
