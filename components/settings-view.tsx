"use client"

import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountSettings } from "@/components/settings/account-settings"
import { CompanySettings } from "@/components/settings/company-settings"
import { VenuesSettings } from "@/components/settings/venues-settings"
import { TeamSettings, type TeamMember, type InviteStatusMap } from "@/components/settings/team-settings"
import { ManagerAccessSettings } from "@/components/settings/manager-access"
import type { ManagerAccessData } from "@/app/actions/manager-access"
import { PreferencesSettings } from "@/components/settings/preferences-settings"
import { NotificationsSettings } from "@/components/settings/notifications-settings"
import type { ReminderSettings } from "@/app/actions/reminders"
import { StaffPreferencesSettings } from "@/components/settings/staff-preferences-settings"
import { BillingSettings } from "@/components/settings/billing-settings"
import { IntegrationsSettings, type IntegrationVenue } from "@/components/settings/integrations-settings"
import { KioskSettings } from "@/components/settings/kiosk-settings"
import { SETTINGS_TABS } from "@/lib/nav-config"
import type { VenueSummary } from "@/components/venue-provider"
import type { CompanyData } from "@/app/actions/company"
import type { BillingState } from "@/app/actions/billing"
import type { SquareConnectionState, SquareLocation } from "@/app/actions/square"
import type { SecurityState } from "@/app/actions/account"

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
  staff = [],
  inviteStatuses = {},
  managerAccess,
  activeVenueName = "this venue",
  defaultTab,
  billing,
  square,
  allowedTabIds,
  personalPreferences,
  reminderSettings,
  security,
}: {
  user: { name: string; email: string }
  company: CompanyData
  venues?: VenueSummary[]
  activeVenueId?: number | null
  staff?: TeamMember[]
  inviteStatuses?: InviteStatusMap
  managerAccess?: ManagerAccessData
  activeVenueName?: string
  defaultTab: string
  billing?: BillingState
  square?: SquareSettingsData
  /** When provided, restricts the visible tabs to this set (e.g. staff users). */
  allowedTabIds?: string[]
  /** When provided (staff), the Preferences tab manages personal, per-user
   * settings instead of the owner's company-wide configuration. */
  personalPreferences?: { hiddenModules: string[] }
  /** Owner-only per-venue shift reminder config. Omitted for staff. */
  reminderSettings?: ReminderSettings[]
  /** Current user's email-verification and 2FA status for the Account tab. */
  security?: SecurityState
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
            <AccountSettings user={user} security={security} />
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
            <div className="grid gap-6">
              {activeVenueId ? (
                <TeamSettings
                  staff={staff}
                  inviteStatuses={inviteStatuses}
                  venueId={activeVenueId}
                  venueName={activeVenueName}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Add a venue first to manage its team.</p>
              )}
              {managerAccess && <ManagerAccessSettings data={managerAccess} />}
            </div>
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
        {visibleIds.has("kiosk") && (
          <TabsContent value="kiosk">
            {activeVenueId ? (
              <KioskSettings venueId={activeVenueId} venueName={activeVenueName} />
            ) : (
              <p className="text-sm text-muted-foreground">Add a venue first to configure a kiosk.</p>
            )}
          </TabsContent>
        )}
        {visibleIds.has("notifications") && (
          <TabsContent value="notifications">
            <NotificationsSettings
              reminderSettings={reminderSettings}
              canManageVenues={!allowedTabIds}
            />
          </TabsContent>
        )}
        {visibleIds.has("preferences") && (
          <TabsContent value="preferences">
            {personalPreferences ? (
              <StaffPreferencesSettings hiddenModules={personalPreferences.hiddenModules} />
            ) : (
              <PreferencesSettings
                hiddenModules={company.hiddenModules}
                hiddenSettingsTabs={company.hiddenSettingsTabs}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
    </>
  )
}
