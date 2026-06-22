"use client"

import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountSettings } from "@/components/settings/account-settings"
import { CompanySettings } from "@/components/settings/company-settings"
import { VenuesSettings } from "@/components/settings/venues-settings"
import { TeamSettings, type TeamMember } from "@/components/settings/team-settings"
import { PreferencesSettings } from "@/components/settings/preferences-settings"
import { BillingSettings } from "@/components/settings/billing-settings"
import { SETTINGS_TABS } from "@/lib/nav-config"
import type { VenueSummary } from "@/components/venue-provider"
import type { CompanyData } from "@/app/actions/company"
import type { BillingState } from "@/app/actions/billing"

export function SettingsView({
  user,
  company,
  venues,
  activeVenueId,
  members,
  activeVenueName,
  defaultTab,
  billing,
}: {
  user: { name: string; email: string }
  company: CompanyData
  venues: VenueSummary[]
  activeVenueId: number | null
  members: TeamMember[]
  activeVenueName: string
  defaultTab: string
  billing: BillingState
}) {
  // A tab is shown if it is not lockable (core) or not in the hidden list.
  const hidden = new Set(company.hiddenSettingsTabs)
  const visibleTabs = SETTINGS_TABS.filter((t) => !t.lockable || !hidden.has(t.id))
  const resolvedDefault = visibleTabs.some((t) => t.id === defaultTab)
    ? defaultTab
    : visibleTabs[0]?.id ?? "account"

  return (
    <>
      <PageHeader title="Settings" description="Manage your account, company, venues, and team." />

      <Tabs defaultValue={resolvedDefault} className="mt-2">
        <TabsList>
          {visibleTabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="account">
          <AccountSettings user={user} />
        </TabsContent>
        <TabsContent value="company">
          <CompanySettings company={company} />
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
        <TabsContent value="billing">
          <BillingSettings billing={billing} />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesSettings
            hiddenModules={company.hiddenModules}
            hiddenSettingsTabs={company.hiddenSettingsTabs}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
