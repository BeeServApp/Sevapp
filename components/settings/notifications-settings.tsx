"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BellRing, Clock, MapPin, Smartphone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EnableNotifications } from "@/components/notifications/enable-notifications"
import { updateReminderSettings, type ReminderSettings } from "@/app/actions/reminders"

export function NotificationsSettings({
  reminderSettings,
  canManageVenues,
}: {
  /** Owner-only per-venue reminder config. Empty/undefined for staff. */
  reminderSettings?: ReminderSettings[]
  canManageVenues: boolean
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-4 text-muted-foreground" />
            Phone alerts on this device
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Get shift and checklist reminders as push notifications on this phone or computer — even when
            Beeserv isn&apos;t open. For the best experience on mobile, add Beeserv to your home screen first.
          </p>
        </CardHeader>
        <CardContent>
          <EnableNotifications />
        </CardContent>
      </Card>

      {canManageVenues && reminderSettings && reminderSettings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4 text-muted-foreground" />
              Shift reminders
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Remind rostered staff before their shift starts (opening checklist) and before it ends
              (closing checklist). Set the lead time per venue.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {reminderSettings.map((v) => (
                <VenueReminderRow key={v.venueId} venue={v} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function VenueReminderRow({ venue }: { venue: ReminderSettings }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(venue.remindersEnabled)
  const [lead, setLead] = useState(String(venue.reminderLeadMins))
  const [saving, setSaving] = useState(false)

  async function persist(patch: { remindersEnabled?: boolean; reminderLeadMins?: number }) {
    setSaving(true)
    try {
      await updateReminderSettings(venue.venueId, patch)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(next: boolean) {
    setEnabled(next)
    await persist({ remindersEnabled: next })
  }

  async function handleLeadBlur() {
    const n = Math.min(360, Math.max(5, Math.round(Number(lead) || 30)))
    setLead(String(n))
    if (n !== venue.reminderLeadMins) await persist({ reminderLeadMins: n })
  }

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <MapPin className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{venue.venueName}</p>
        <p className="text-sm text-muted-foreground">
          {enabled ? `Reminders on · ${lead} min before` : "Reminders off"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <Label htmlFor={`lead-${venue.venueId}`} className="sr-only">
          Reminder lead time in minutes for {venue.venueName}
        </Label>
        <Input
          id={`lead-${venue.venueId}`}
          type="number"
          inputMode="numeric"
          min={5}
          max={360}
          value={lead}
          disabled={!enabled || saving}
          onChange={(e) => setLead(e.target.value)}
          onBlur={handleLeadBlur}
          className="w-20"
          aria-label={`Reminder lead time for ${venue.venueName}`}
        />
        <span className="text-sm text-muted-foreground">min</span>
      </div>

      <Switch
        checked={enabled}
        disabled={saving}
        onCheckedChange={handleToggle}
        aria-label={`Toggle shift reminders for ${venue.venueName}`}
      />
    </li>
  )
}
