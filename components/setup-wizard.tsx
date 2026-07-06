"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TwoFactorSetup } from "@/components/two-factor-setup"
import {
  saveSetupCompany,
  saveSetupVenue,
  inviteSetupTeam,
  completeSetup,
  type SetupState,
  type InviteInput,
} from "@/app/actions/setup"
import { Building2, Store, Users, ShieldCheck, Plus, Trash2, Check } from "lucide-react"

const COUNTRIES = ["United Kingdom", "Ireland", "United States", "Canada", "Australia", "New Zealand"]
const CURRENCIES = ["GBP", "EUR", "USD", "CAD", "AUD", "NZD"]
const TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
]
const VENUE_TYPES = ["Pub", "Bar", "Restaurant", "Cafe", "Hotel", "Nightclub", "Brewery", "Other"]
const ROLES = ["Manager", "Supervisor", "Bartender", "Server", "Chef", "Kitchen", "Staff"]

type StepId = "company" | "venue" | "team" | "security"

const STEPS: { id: StepId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "venue", label: "First venue", icon: Store },
  { id: "team", label: "Team", icon: Users },
  { id: "security", label: "Security", icon: ShieldCheck },
]

export function SetupWizard({ initial }: { initial: SetupState }) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Company
  const [companyName, setCompanyName] = useState(initial.company.name)
  const [country, setCountry] = useState(initial.company.country)
  const [currency, setCurrency] = useState(initial.company.currency)
  const [timezone, setTimezone] = useState(initial.company.timezone)

  // Venue
  const [venueName, setVenueName] = useState(initial.firstVenue?.name ?? "")
  const [venueType, setVenueType] = useState(initial.firstVenue?.type ?? "Pub")
  const [venueCity, setVenueCity] = useState(initial.firstVenue?.city ?? "")
  const [venueAddress, setVenueAddress] = useState("")
  const [venuePostcode, setVenuePostcode] = useState("")

  // Team
  const [invites, setInvites] = useState<InviteInput[]>([{ name: "", email: "", role: "Manager" }])
  const [invitedCount, setInvitedCount] = useState<number | null>(null)

  // Security
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initial.twoFactorEnabled)

  const step = STEPS[stepIndex]
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  function next() {
    setError(null)
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }
  function back() {
    setError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  async function handleCompanyNext() {
    if (!companyName.trim()) {
      setError("Enter your company or business name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveSetupCompany({ name: companyName, country, currency, timezone, brandColor: initial.company.brandColor })
      next()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleVenueNext() {
    if (!venueName.trim()) {
      setError("Give your venue a name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveSetupVenue({
        name: venueName,
        type: venueType,
        address: venueAddress,
        city: venueCity,
        postcode: venuePostcode,
      })
      next()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the venue. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleTeamNext() {
    const filled = invites.filter((i) => i.name.trim() && i.email.trim())
    if (filled.length === 0) {
      next()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { invited } = await inviteSetupTeam(filled)
      setInvitedCount(invited)
      next()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invites. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      await completeSetup()
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup. Try again.")
      setSaving(false)
    }
  }

  function updateInvite(index: number, patch: Partial<InviteInput>) {
    setInvites((prev) => prev.map((inv, i) => (i === index ? { ...inv, ...patch } : inv)))
  }
  function addInviteRow() {
    setInvites((prev) => [...prev, { name: "", email: "", role: "Staff" }])
  }
  function removeInviteRow(index: number) {
    setInvites((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  return (
    <main className="flex min-h-svh flex-col items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-12" priority />
        </div>

        {/* Stepper */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = i < stepIndex
              const active = i === stepIndex
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full border text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : done
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <span
                    className={`hidden text-sm font-medium sm:inline ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              {step.id === "company" && "Tell us about your business"}
              {step.id === "venue" && "Set up your first venue"}
              {step.id === "team" && "Invite your team"}
              {step.id === "security" && "Secure your account"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {step.id === "company" && "This appears across your workspace, reports and invoices."}
              {step.id === "venue" && "You can add more venues later from Settings."}
              {step.id === "team" && "Send join links so staff can access their rota. Optional — you can skip for now."}
              {step.id === "security" &&
                "Add two-factor authentication for an extra layer of protection. Optional but recommended."}
            </p>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {/* ── Company ─────────────────────────────────────────────── */}
            {step.id === "company" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="w-company">Business name</Label>
                  <Input
                    id="w-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="The Whitfield Group"
                    autoFocus
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Country</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* ── Venue ───────────────────────────────────────────────── */}
            {step.id === "venue" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="w-venue">Venue name</Label>
                    <Input
                      id="w-venue"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      placeholder="The Crown Inn"
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={venueType} onValueChange={setVenueType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VENUE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="w-address">Address</Label>
                  <Input
                    id="w-address"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="12 High Street"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="w-city">Town / city</Label>
                    <Input id="w-city" value={venueCity} onChange={(e) => setVenueCity(e.target.value)} placeholder="York" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="w-postcode">Postcode</Label>
                    <Input
                      id="w-postcode"
                      value={venuePostcode}
                      onChange={(e) => setVenuePostcode(e.target.value)}
                      placeholder="YO1 9QL"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── Team ────────────────────────────────────────────────── */}
            {step.id === "team" && (
              <div className="flex flex-col gap-3">
                {invites.map((inv, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      {i === 0 && <Label className="text-xs">Name</Label>}
                      <Input
                        value={inv.name}
                        onChange={(e) => updateInvite(i, { name: e.target.value })}
                        placeholder="Sarah Whitfield"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      {i === 0 && <Label className="text-xs">Email</Label>}
                      <Input
                        type="email"
                        value={inv.email}
                        onChange={(e) => updateInvite(i, { email: e.target.value })}
                        placeholder="sarah@venue.co.uk"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      {i === 0 && <Label className="text-xs">Role</Label>}
                      <Select value={inv.role} onValueChange={(v) => updateInvite(i, { role: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInviteRow(i)}
                      disabled={invites.length === 1}
                      aria-label="Remove row"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={addInviteRow}>
                    <Plus className="mr-1 size-4" />
                    Add another
                  </Button>
                </div>
              </div>
            )}

            {/* ── Security ────────────────────────────────────────────── */}
            {step.id === "security" && (
              <div className="flex flex-col gap-4">
                {!initial.emailVerified && (
                  <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    We&apos;ve sent a verification link to <span className="font-medium text-foreground">{initial.email}</span>.
                    Check your inbox to confirm your address — you can keep going in the meantime.
                  </div>
                )}
                <TwoFactorSetup enabled={twoFactorEnabled} onChange={setTwoFactorEnabled} />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {/* ── Nav buttons ─────────────────────────────────────────── */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={back} disabled={stepIndex === 0 || saving}>
                Back
              </Button>
              <div className="flex items-center gap-2">
                {step.id === "company" && (
                  <Button onClick={handleCompanyNext} disabled={saving}>
                    {saving ? "Saving..." : "Continue"}
                  </Button>
                )}
                {step.id === "venue" && (
                  <Button onClick={handleVenueNext} disabled={saving}>
                    {saving ? "Saving..." : "Continue"}
                  </Button>
                )}
                {step.id === "team" && (
                  <>
                    <Button variant="ghost" onClick={next} disabled={saving}>
                      Skip
                    </Button>
                    <Button onClick={handleTeamNext} disabled={saving}>
                      {saving ? "Sending..." : "Send invites"}
                    </Button>
                  </>
                )}
                {step.id === "security" && (
                  <Button onClick={finish} disabled={saving}>
                    {saving ? "Finishing..." : twoFactorEnabled ? "Finish" : "Finish setup"}
                  </Button>
                )}
              </div>
            </div>

            {step.id === "security" && invitedCount != null && invitedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{invitedCount} invited</Badge>
                Invitations sent to your team.
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          You can change any of this later in Settings.
        </p>
      </div>
    </main>
  )
}
