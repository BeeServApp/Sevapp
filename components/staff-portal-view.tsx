"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { HomeView } from "@/components/portal/home-view"
import { RotaView } from "@/components/portal/rota-view"
import { TimecardsView } from "@/components/portal/timecards-view"
import { MeView } from "@/components/portal/me-view"
import type { HomeData, TeamShift } from "@/app/actions/portal"
import type { DbTimecard, DbAvailability } from "@/lib/db/schema"

interface StaffPortalViewProps {
  home: HomeData
  rota: { venueName: string; shifts: TeamShift[] }
  timecards: DbTimecard[]
  weekStart: string
  me: {
    name: string
    email: string
    role: string | null
    venueId: number
    staffMemberId: number | null
  }
  availability: DbAvailability[]
  rotaDays: string[]
}

/**
 * Staff self-service experience rendered inside the standard sidebar shell.
 * It reuses the existing, focused portal views (home, rota, timecards, profile)
 * but presents them as tabs so staff only ever see their own data — never the
 * owner's full scheduling management console.
 */
export function StaffPortalView({
  home,
  rota,
  timecards,
  weekStart,
  me,
  availability,
  rotaDays,
}: StaffPortalViewProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Tabs defaultValue="home" className="gap-6">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="rota">Rota</TabsTrigger>
          <TabsTrigger value="timecards">Timecards</TabsTrigger>
          <TabsTrigger value="me">Me</TabsTrigger>
        </TabsList>

        <TabsContent value="home">
          <HomeView data={home} />
        </TabsContent>
        <TabsContent value="rota">
          <RotaView weekStart={weekStart} venueName={rota.venueName} shifts={rota.shifts} />
        </TabsContent>
        <TabsContent value="timecards">
          <TimecardsView weekStart={weekStart} timecards={timecards} />
        </TabsContent>
        <TabsContent value="me">
          <MeView
            name={me.name}
            email={me.email}
            role={me.role}
            venueId={me.venueId}
            staffMemberId={me.staffMemberId}
            rotaDays={rotaDays}
            initialAvailability={availability}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
