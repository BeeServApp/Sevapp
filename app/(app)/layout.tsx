import type React from "react"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { VenueProvider } from "@/components/venue-provider"
import { RealtimeProvider } from "@/components/realtime-provider"
import { db } from "@/lib/db"
import { venue as venueTable } from "@/lib/db/schema"
import { getAccessibleVenueIds, getActiveVenueId, getCurrentUser, getSession } from "@/lib/session"
import { ensureSeeded } from "@/lib/seed"
import { getCompany } from "@/app/actions/company"
import { getMyBusinesses } from "@/app/actions/business"
import { getMyPreferences } from "@/app/actions/preferences"
import { computeAccess, ensureCompanyRow } from "@/lib/trial"
import { isSuperAdminEmail } from "@/lib/admin"
import { asc, eq } from "drizzle-orm"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()

  // Only owners get demo data seeded; staff read their owner's data.
  if (me.appRole === "owner") {
    await ensureSeeded(session.user.id, session.user.name, session.user.email)
  }

  // Venues are always scoped to the owning account (accountId).
  const allVenues = await db
    .select()
    .from(venueTable)
    .where(eq(venueTable.userId, me.accountId))
    .orderBy(asc(venueTable.id))

  // Non-owners only see the venues they have access to (managers: their single
  // venue, area managers: their assigned set). Owners see everything.
  const accessibleIds = me.appRole === "owner" ? null : new Set(await getAccessibleVenueIds(me))
  const venues = accessibleIds ? allVenues.filter((v) => accessibleIds.has(v.id)) : allVenues
  const company = await getCompany()
  const activeVenueId = await getActiveVenueId(me.accountId)

  // Enforce the trial/subscription gate for owners. Staff are never gated.
  // The billing settings page is always reachable so they can subscribe.
  if (me.appRole === "owner") {
    const access = computeAccess(await ensureCompanyRow(me.accountId))
    if (access.locked) redirect("/settings?tab=billing&locked=1")
  }

  const businesses = me.appRole === "owner" ? await getMyBusinesses() : []

  // Staff module restriction (scheduling + tasks only) is handled in AppSidebar
  // via STAFF_ALLOWED_PATHS. Owners apply their company-wide hidden modules;
  // staff apply their own personal preferences instead of the owner's config.
  const hiddenModules =
    me.appRole === "staff" ? (await getMyPreferences()).hiddenModules : company.hiddenModules

  return (
    <RealtimeProvider>
      <VenueProvider
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
        user={{ name: me.name, email: me.email }}
        hiddenModules={hiddenModules}
        appRole={me.appRole}
        managerRole={me.managerRole}
        businesses={businesses}
        isSuperAdmin={isSuperAdminEmail(me.email)}
      >
        <div className="flex h-screen overflow-hidden bg-background">
          <div className="hidden shrink-0 md:block">
            <AppSidebar />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <AppTopbar />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>
            </main>
          </div>
        </div>
      </VenueProvider>
    </RealtimeProvider>
  )
}
