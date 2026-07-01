import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { OperationsView } from "@/components/operations-view"
import { getActiveVenueId, getSession, guardOwnerPage } from "@/lib/session"
import {
  getEvents,
  getMaintenance,
  getOrders,
  getSuppliers,
  getTasks,
} from "@/app/actions/operations"
import { getAssets } from "@/app/actions/assets"

export const metadata: Metadata = {
  title: "Operations — Tapsheet",
}

export default async function OperationsPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  await guardOwnerPage()

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start managing operations.
      </p>
    )
  }

  const [orders, suppliers, maintenance, events, tasks, assets] = await Promise.all([
    getOrders(venueId),
    getSuppliers(venueId),
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
      orders={orders}
      suppliers={suppliers}
      maintenance={maintenance}
      events={events}
      tasks={tasks}
      assetOptions={assetOptions}
    />
  )
}
