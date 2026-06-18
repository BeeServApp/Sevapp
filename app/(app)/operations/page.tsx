import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { OperationsView } from "@/components/operations-view"
import { getActiveVenueId, getSession } from "@/lib/session"
import {
  getEvents,
  getMaintenance,
  getOrders,
  getSuppliers,
  getTasks,
} from "@/app/actions/operations"

export const metadata: Metadata = {
  title: "Operations — Tapsheet",
}

export default async function OperationsPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start managing operations.
      </p>
    )
  }

  const [orders, suppliers, maintenance, events, tasks] = await Promise.all([
    getOrders(venueId),
    getSuppliers(venueId),
    getMaintenance(venueId),
    getEvents(venueId),
    getTasks(venueId),
  ])

  return (
    <OperationsView
      venueId={venueId}
      orders={orders}
      suppliers={suppliers}
      maintenance={maintenance}
      events={events}
      tasks={tasks}
    />
  )
}
