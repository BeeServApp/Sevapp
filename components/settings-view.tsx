"use client"

import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountSettings } from "@/components/settings/account-settings"
import { CompanySettings } from "@/components/settings/company-settings"
import { VenuesSettings } from "@/components/settings/venues-settings"
import { TeamSettings, type TeamMember } from "@/components/settings/team-settings"
import { PreferencesSettings } from "@/components/settings/preferences-settings"
import { BillingSettings } from "@/components/settings/billing-settings"
import { IntegrationsSettings, type IntegrationVenue } from "@/components/settings/integrations-settings"
import { SETTINGS_TABS } from "@/lib/nav-config"
import type { VenueSummary } from "@/components/venue-provider"
import type { CompanyData } from "@/app/actions/company"
import type { BillingState } from "@/app/actions/billing"
import type { SquareConnectionState, SquareLocation } from "@/app/actions/square"

export interface SquareSettingsData {
  connection: SquareConnectionState
  venues: IntegrationVenue[]
  locations: SquareLocation[]
  flash: { connected: boolean; error: string | null }
}

export function SettingsView({
  user,
  company,
  venues = [],
  activeVenueId = null,
  members = [],
  activeVenueName = "this venue",
  defaultTab,
  billing,
  square,
  allowedTabIds,
}: {
  user: { name: string; email: string }
  company: CompanyData
  venues?: VenueSummary[]
  activeVenueId?: number | null
  members?: TeamMember[]
  activeVenueName?: string
  defaultTab: string
  billing?: BillingState
  square?: SquareSettingsData
  /** When provided, restricts the visible tabs to this set (e.g. staff users). */
  allowedTabIds?: string[]
}) {
  // A tab is shown if it is not lockable (core) or not in the hidden list, and —
  // when an allow-list is provided (staff) — only if it is explicitly allowed.
  const hidden = new Set(company.hiddenSettingsTabs)
  const visibleTabs = SETTINGS_TABS.filter(
    (t) => (!t.lockable || !hidden.has(t.id)) && (!allowedTabIds || allowedTabIds.includes(t.id)),
  )
  const visibleIds = new Set(visibleTabs.map((t) => t.id))
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

        {visibleIds.has("account") && (
          <TabsContent value="account">
            <AccountSettings user={user} />
          </TabsContent>
        )}
        {visibleIds.has("company") && (
          <TabsContent value="company">
            <CompanySettings company={company} />
          </TabsContent>
        )}
        {visibleIds.has("venues") && (
          <TabsContent value="venues">
            <VenuesSettings venues={venues} activeVenueId={activeVenueId} />
          </TabsContent>
        )}
        {visibleIds.has("team") && (
          <TabsContent value="team">
            {activeVenueId ? (
              <TeamSettings members={members} venueId={activeVenueId} venueName={activeVenueName} />
            ) : (
              <p className="text-sm text-muted-foreground">Add a venue first to manage its team.</p>
            )}
          </TabsContent>
        )}
        {visibleIds.has("billing") && billing && (
          <TabsContent value="billing">
            <BillingSettings billing={billing} />
          </TabsContent>
        )}
        {visibleIds.has("integrations") && square && (
          <TabsContent value="integrations">
            <IntegrationsSettings
              connection={square.connection}
              venues={square.venues}
              locations={square.locations}
              flash={square.flash}
            />
          </TabsContent>
        )}
        {visibleIds.has("preferences") && (
          <TabsContent value="preferences">
            <PreferencesSettings
              hiddenModules={company.hiddenModules}
              hiddenSettingsTabs={company.hiddenSettingsTabs}
            />
          </TabsContent>
        )}
      </Tabs>
    </>
  )
}
