import type React from "react"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { VenueProvider } from "@/components/venue-provider"
import { getActiveVenueId, getSession } from "@/lib/session"
import { ensureSeeded } from "@/lib/seed"
import { getVenues } from "@/app/actions/venues"
import { getCompany } from "@/app/actions/company"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")


  await ensureSeeded(session.user.id, session.user.name, session.user.email)

  const venues = await getVenues()
  const company = await getCompany()
  const activeVenueId = await getActiveVenueId(session.user.id)

  return (
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
      user={{ name: session.user.name, email: session.user.email }}
      hiddenModules={company.hiddenModules}
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
  )
}
