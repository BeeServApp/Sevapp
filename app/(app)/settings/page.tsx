import { redirect } from "next/navigation"
import { SettingsView } from "@/components/settings-view"
import { getActiveVenueId, getSession, guardOwnerPage } from "@/lib/session"
import { getVenues } from "@/app/actions/venues"
import { getCompany } from "@/app/actions/company"
import { getMembers } from "@/app/actions/members"
import { getBillingState, syncSubscriptionFromCheckout } from "@/app/actions/billing"
import { SETTINGS_TABS } from "@/lib/nav-config"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; session_id?: string; checkout?: string }>
}) {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  await guardOwnerPage()

  const { tab, session_id } = await searchParams
  const validTabs = SETTINGS_TABS.map((t) => t.id)
  const defaultTab = tab && validTabs.includes(tab) ? tab : "account"

  // Returning from Stripe Checkout — confirm and persist the subscription.
  if (session_id) {
    await syncSubscriptionFromCheckout(session_id).catch(() => {})
  }

  const billing = await getBillingState()
  const company = await getCompany()
  const venues = await getVenues()
  const activeVenueId = await getActiveVenueId(session.user.id)
  const activeVenue = venues.find((v) => v.id === activeVenueId) ?? venues[0] ?? null
  const members = activeVenueId ? await getMembers(activeVenueId) : []

  return (
    <SettingsView
      user={{ name: session.user.name, email: session.user.email }}
      company={company}
      venues={venues.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        address: v.address,
        city: v.city,
        postcode: v.postcode,
        phone: v.phone,
        email: v.email,
        managerName: v.managerName,
        capacity: v.capacity,
        floors: v.floors,
        licenseNumber: v.licenseNumber,
        licenseType: v.licenseType,
        openingHours: v.openingHours,
        status: v.status,
        openingDate: v.openingDate,
        notes: v.notes,
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
      billing={billing}
    />
  )
}
