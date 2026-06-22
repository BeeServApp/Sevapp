import type React from "react"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { VenueProvider } from "@/components/venue-provider"
import { RealtimeProvider } from "@/components/realtime-provider"
import { db } from "@/lib/db"
import { venue as venueTable } from "@/lib/db/schema"
import { getActiveVenueId, getCurrentUser, getSession } from "@/lib/session"
import { ensureSeeded } from "@/lib/seed"
import { getCompany } from "@/app/actions/company"
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
  const venues = await db
    .select()
    .from(venueTable)
    .where(eq(venueTable.userId, me.accountId))
    .orderBy(asc(venueTable.id))
  const company = await getCompany()
  const activeVenueId = await getActiveVenueId(me.accountId)

  // Staff are locked to scheduling + tasks; hide every other module.
  const hiddenModules =
    me.appRole === "staff"
      ? ["/operations", "/assets", "/financials", "/compliance"]
      : company.hiddenModules

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
