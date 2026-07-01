"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { HomeView } from "@/components/portal/home-view"
import { RotaView } from "@/components/portal/rota-view"
import { TimecardsView } from "@/components/portal/timecards-view"
import { LeaveView } from "@/components/portal/leave-view"
import { MeView } from "@/components/portal/me-view"
import { OnboardingView } from "@/components/portal/onboarding-view"
import type { HomeData, RotaData } from "@/app/actions/portal"
import type { DbTimecard, DbAvailability, DbLeaveRequest, DbOnboarding } from "@/lib/db/schema"

interface StaffPortalViewProps {
  home: HomeData
  rota: RotaData
  timecards: DbTimecard[]
  leave: DbLeaveRequest[]
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
  onboarding: DbOnboarding | null
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
  leave,
  weekStart,
  me,
  availability,
  rotaDays,
  onboarding,
}: StaffPortalViewProps) {
  // Nudge staff to finish onboarding: open on that tab when it's outstanding.
  const onboardingOutstanding = onboarding != null && onboarding.status !== "approved"
  const showOnboarding = onboarding != null
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Tabs defaultValue={onboardingOutstanding ? "onboarding" : "home"} className="gap-6">
        <TabsList className="w-full max-w-xl">
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="rota">Rota</TabsTrigger>
          <TabsTrigger value="timecards">Timecards</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          {showOnboarding && <TabsTrigger value="onboarding">Onboarding</TabsTrigger>}
          <TabsTrigger value="me">Me</TabsTrigger>
        </TabsList>

        <TabsContent value="home">
          <HomeView data={home} />
        </TabsContent>
        {showOnboarding && (
          <TabsContent value="onboarding">
            <OnboardingView initialRecord={onboarding} />
          </TabsContent>
        )}
        <TabsContent value="rota">
          <RotaView
            weekStart={weekStart}
            venueName={rota.venueName}
            shifts={rota.shifts}
            openShifts={rota.openShifts}
            mySwaps={rota.mySwaps}
            teammates={rota.teammates}
          />
        </TabsContent>
        <TabsContent value="timecards">
          <TimecardsView weekStart={weekStart} timecards={timecards} />
        </TabsContent>
        <TabsContent value="leave">
          <LeaveView initialLeave={leave} />
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
