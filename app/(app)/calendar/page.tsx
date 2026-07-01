import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CalendarView } from "@/components/calendar-view"
import { getActiveVenueId, getSession, guardOwnerPage } from "@/lib/session"
import { getCalendarData } from "@/app/actions/calendar"

export const metadata: Metadata = {
  title: "Calendar — Beeserv",
}

export default async function CalendarPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  await guardOwnerPage()

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start scheduling.
      </p>
    )
  }

  const { events, datedChecks, datedActions, datedMeetings, datedMaintenance, linkable } =
    await getCalendarData(venueId)

  return (
    <CalendarView
      venueId={venueId}
      initialEvents={events}
      datedChecks={datedChecks}
      datedActions={datedActions}
      datedMeetings={datedMeetings}
      datedMaintenance={datedMaintenance}
      linkable={linkable}
    />
  )
}
