"use client"

import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountSettings } from "@/components/settings/account-settings"
import { VenuesSettings } from "@/components/settings/venues-settings"
import { TeamSettings, type TeamMember } from "@/components/settings/team-settings"
import type { VenueSummary } from "@/components/venue-provider"

export function SettingsView({
  user,
  venues,
  activeVenueId,
  members,
  activeVenueName,
  defaultTab,
}: {
  user: { name: string; email: string }
  venues: VenueSummary[]
  activeVenueId: number | null
  members: TeamMember[]
  activeVenueName: string
  defaultTab: string
}) {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account, venues, and team." />

      <Tabs defaultValue={defaultTab} className="mt-2">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
          <TabsTrigger value="team">Team &amp; users</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <AccountSettings user={user} />
        </TabsContent>
        <TabsContent value="venues">
          <VenuesSettings venues={venues} activeVenueId={activeVenueId} />
        </TabsContent>
        <TabsContent value="team">
          {activeVenueId ? (
            <TeamSettings members={members} venueId={activeVenueId} venueName={activeVenueName} />
          ) : (
            <p className="text-sm text-muted-foreground">Add a venue first to manage its team.</p>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
