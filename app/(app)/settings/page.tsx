import { redirect } from "next/navigation"
import { SettingsView } from "@/components/settings-view"
import { getActiveVenueId, getSession } from "@/lib/session"
import { getVenues } from "@/app/actions/venues"
import { getMembers } from "@/app/actions/members"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const { tab } = await searchParams
  const validTabs = ["account", "venues", "team"]
  const defaultTab = tab && validTabs.includes(tab) ? tab : "account"

  const venues = await getVenues()
  const activeVenueId = await getActiveVenueId(session.user.id)
  const activeVenue = venues.find((v) => v.id === activeVenueId) ?? venues[0] ?? null
  const members = activeVenueId ? await getMembers(activeVenueId) : []

  return (
    <SettingsView
      user={{ name: session.user.name, email: session.user.email }}
      venues={venues.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        address: v.address,
        city: v.city,
      }))}
      activeVenueId={activeVenueId}
      members={members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
      }))}
      activeVenueName={activeVenue?.name ?? "this venue"}
      defaultTab={defaultTab}
    />
  )
}
