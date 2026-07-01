import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CalendarView } from "@/components/calendar-view"
import { getAccessibleVenueIds, getActiveVenueId, getSession, guardCalendarPage } from "@/lib/session"
import { getWorkspaceCalendarData } from "@/app/actions/calendar"

export const metadata: Metadata = {
  title: "Calendar — Beeserv",
}

export default async function CalendarPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  // Owners, managers and area managers may view the workspace calendar.
  const me = await guardCalendarPage()

  const accessibleIds = await getAccessibleVenueIds(me)
  if (accessibleIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue available. Add a venue in Settings to start scheduling.
      </p>
    )
  }

  // Default venue for creating new entries: the active venue if it's accessible,
  // otherwise the first accessible venue.
  const active = await getActiveVenueId(me.accountId)
  const defaultVenueId =
    active != null && accessibleIds.includes(active) ? active : accessibleIds[0]

  const { venues, events, datedChecks, datedActions, datedMeetings, datedMaintenance, linkable } =
    await getWorkspaceCalendarData(accessibleIds)

  return (
    <CalendarView
      venueId={defaultVenueId}
      venues={venues}
      initialEvents={events}
      datedChecks={datedChecks}
      datedActions={datedActions}
      datedMeetings={datedMeetings}
      datedMaintenance={datedMaintenance}
      linkable={linkable}
    />
  )
}
