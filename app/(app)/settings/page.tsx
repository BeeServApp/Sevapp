import { redirect } from "next/navigation"
import { SettingsView } from "@/components/settings-view"
import { getActiveVenueId, getCurrentUser, getSession } from "@/lib/session"
import { getVenues } from "@/app/actions/venues"
import { getCompany } from "@/app/actions/company"
import { getStaffMembers, getStaffInviteStatuses } from "@/app/actions/staff"
import { getManagerAccess } from "@/app/actions/manager-access"
import { getBillingState, syncSubscriptionFromCheckout } from "@/app/actions/billing"
import { getSquareConnection, listSquareLocations } from "@/app/actions/square"
import { getMyPreferences } from "@/app/actions/preferences"
import { getReminderSettings } from "@/app/actions/reminders"
import { getSecurityState } from "@/app/actions/account"
import { SETTINGS_TABS, STAFF_ALLOWED_SETTINGS_TABS } from "@/lib/nav-config"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    session_id?: string
    checkout?: string
    square_connected?: string
    square_error?: string
  }>
}) {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()
  const { tab, session_id, square_connected, square_error } = await searchParams

  // ── Staff: profile + personal preferences only ─────────────────────────────
  if (me.appRole === "staff") {
    const staffDefault =
      tab && STAFF_ALLOWED_SETTINGS_TABS.includes(tab) ? tab : "account"
    const [company, prefs, security] = await Promise.all([
      getCompany(),
      getMyPreferences(),
      getSecurityState(),
    ])
    return (
      <SettingsView
        user={{ name: me.name, email: me.email }}
        company={company}
        defaultTab={staffDefault}
        allowedTabIds={STAFF_ALLOWED_SETTINGS_TABS}
        personalPreferences={{ hiddenModules: prefs.hiddenModules }}
        security={security}
      />
    )
  }

  // ── Owner: full settings ────────────────────────────────────────────────────
  const validTabs = SETTINGS_TABS.map((t) => t.id)
  const defaultTab = tab && validTabs.includes(tab) ? tab : "account"

  // Returning from Stripe Checkout — confirm and persist the subscription.
  if (session_id) {
    await syncSubscriptionFromCheckout(session_id).catch(() => {})
  }

  const billing = await getBillingState()
  const company = await getCompany()
  const venues = await getVenues()

  // Square integration: status + locations (locations only when connected).
  const squareConnection = await getSquareConnection()
  const squareLocations = squareConnection.connected ? await listSquareLocations() : []
  const activeVenueId = await getActiveVenueId(session.user.id)
  const activeVenue = venues.find((v) => v.id === activeVenueId) ?? venues[0] ?? null
  const staff = activeVenueId ? await getStaffMembers(activeVenueId) : []
  const inviteStatuses = activeVenueId ? await getStaffInviteStatuses(activeVenueId) : {}
  const managerAccess = await getManagerAccess()
  const reminderSettings = await getReminderSettings()
  const security = await getSecurityState()

  return (
    <SettingsView
      user={{ name: session.user.name, email: session.user.email }}
      company={company}
      security={security}
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
      staff={staff}
      inviteStatuses={inviteStatuses}
      activeVenueName={activeVenue?.name ?? "this venue"}
      managerAccess={managerAccess}
      reminderSettings={reminderSettings}
      defaultTab={defaultTab}
      billing={billing}
      square={{
        connection: squareConnection,
        venues: venues.map((v) => ({
          id: v.id,
          name: v.name,
          squareLocationId: v.squareLocationId ?? null,
        })),
        locations: squareLocations,
        flash: { connected: square_connected === "1", error: square_error ?? null },
      }}
    />
  )
}
