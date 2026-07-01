"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createVenue, updateVenue } from "@/app/actions/venues"
import { getStaffMembers } from "@/app/actions/staff"
import type { VenueSummary } from "@/components/venue-provider"
import type { DbStaffMember } from "@/lib/db/schema"

const CUSTOM_MANAGER = "__custom__"

const venueTypes = ["Pub", "Bar", "Restaurant", "Hotel", "Cafe", "Nightclub", "Brewery"]
const licenseTypes = ["Premises Licence", "Personal Licence", "Club Premises", "TENs", "Other"]
const statuses = ["Active", "Pre-opening", "Temporarily closed", "Closed"]

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

interface DayHours {
  day: string
  open: string
  close: string
  closed: boolean
}

function defaultHours(): DayHours[] {
  return DAYS.map((day) => ({ day, open: "09:00", close: "23:00", closed: false }))
}

function parseHours(raw: string | null | undefined): DayHours[] {
  if (!raw) return defaultHours()
  try {
    const parsed = JSON.parse(raw) as DayHours[]
    if (!Array.isArray(parsed)) return defaultHours()
    return DAYS.map((day) => {
      const found = parsed.find((p) => p.day === day)
      return found
        ? { day, open: found.open ?? "09:00", close: found.close ?? "23:00", closed: !!found.closed }
        : { day, open: "09:00", close: "23:00", closed: false }
    })
  } catch {
    return defaultHours()
  }
}

export function VenueDialog({
  mode,
  venue,
  trigger,
}: {
  mode: "add" | "edit"
  venue?: VenueSummary
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(venue?.name ?? "")
  const [type, setType] = useState(venue?.type ?? "Pub")
  const [status, setStatus] = useState(venue?.status ?? "Active")
  const [address, setAddress] = useState(venue?.address ?? "")
  const [city, setCity] = useState(venue?.city ?? "")
  const [postcode, setPostcode] = useState(venue?.postcode ?? "")
  const [phone, setPhone] = useState(venue?.phone ?? "")
  const [email, setEmail] = useState(venue?.email ?? "")
  const [managerName, setManagerName] = useState(venue?.managerName ?? "")
  const [staffOptions, setStaffOptions] = useState<DbStaffMember[]>([])
  // When true, the manager is typed free-text rather than picked from the team.
  const [managerCustom, setManagerCustom] = useState(false)
  const [capacity, setCapacity] = useState(venue?.capacity != null ? String(venue.capacity) : "")
  const [floors, setFloors] = useState(venue?.floors != null ? String(venue.floors) : "")
  const [licenseNumber, setLicenseNumber] = useState(venue?.licenseNumber ?? "")
  const [licenseType, setLicenseType] = useState(venue?.licenseType ?? "Premises Licence")
  const [openingDate, setOpeningDate] = useState(venue?.openingDate ?? "")
  const [notes, setNotes] = useState(venue?.notes ?? "")
  const [hours, setHours] = useState<DayHours[]>(parseHours(venue?.openingHours))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    if (mode === "add") {
      setName("")
      setType("Pub")
      setStatus("Active")
      setAddress("")
      setCity("")
      setPostcode("")
      setPhone("")
      setEmail("")
      setManagerName("")
      setCapacity("")
      setFloors("")
      setLicenseNumber("")
      setLicenseType("Premises Licence")
      setOpeningDate("")
      setNotes("")
      setHours(defaultHours())
    }
    setError(null)
    setSaving(false)
  }

  function setDay(day: string, patch: Partial<DayHours>) {
    setHours((prev) => prev.map((h) => (h.day === day ? { ...h, ...patch } : h)))
  }

  // Load the venue's team so the manager can be picked from existing members.
  async function loadStaff() {
    if (mode !== "edit" || !venue) {
      setManagerCustom(true)
      return
    }
    try {
      const members = await getStaffMembers(venue.id)
      setStaffOptions(members)
      const current = venue.managerName ?? ""
      setManagerCustom(!!current && !members.some((m) => m.name === current))
    } catch {
      setManagerCustom(true)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Venue name is required.")
    setSaving(true)
    setError(null)
    const payload = {
      name,
      type,
      status,
      address,
      city,
      postcode,
      phone,
      email,
      managerName,
      capacity: capacity.trim() ? Number.parseInt(capacity, 10) : null,
      floors: floors.trim() ? Number.parseInt(floors, 10) : null,
      licenseNumber,
      licenseType,
      openingDate,
      notes,
      openingHours: JSON.stringify(hours),
    }
    try {
      if (mode === "add") {
        await createVenue(payload)
      } else if (venue) {
        await updateVenue(venue.id, payload)
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save venue.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) loadStaff()
        if (!o) reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>{mode === "add" ? "Add venue" : "Edit venue"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Create a new venue to manage its operations and assets."
              : "Update the details for this venue."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5">
            {/* Basics */}
            <section className="grid gap-4">
              <h3 className="text-sm font-semibold text-foreground">Venue details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="venue-name">Venue name</Label>
                  <Input
                    id="venue-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. The Crown & Anchor"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-type">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v ?? "Pub")}>
                    <SelectTrigger id="venue-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {venueTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v ?? "Active")}>
                    <SelectTrigger id="venue-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-capacity">Max capacity</Label>
                  <Input
                    id="venue-capacity"
                    type="number"
                    min={0}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="e.g. 180"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-floors">Floors / areas</Label>
                  <Input
                    id="venue-floors"
                    type="number"
                    min={0}
                    value={floors}
                    onChange={(e) => setFloors(e.target.value)}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-opened">Opening date</Label>
                  <Input
                    id="venue-opened"
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* License */}
            <section className="grid gap-4">
              <h3 className="text-sm font-semibold text-foreground">Licensing</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="venue-license-type">Licence type</Label>
                  <Select value={licenseType} onValueChange={(v) => setLicenseType(v ?? "Premises Licence")}>
                    <SelectTrigger id="venue-license-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {licenseTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-license-no">Licence number</Label>
                  <Input
                    id="venue-license-no"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. PL-2024-0192"
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Contact & address */}
            <section className="grid gap-4">
              <h3 className="text-sm font-semibold text-foreground">Contact &amp; address</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="venue-address">Address</Label>
                  <Input
                    id="venue-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 12 Harbourside"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-city">City / region</Label>
                  <Input
                    id="venue-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bristol"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-postcode">Postcode</Label>
                  <Input
                    id="venue-postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="e.g. BS1 5TT"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-phone">Phone</Label>
                  <Input
                    id="venue-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0117 123 4567"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue-email">Email</Label>
                  <Input
                    id="venue-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="venue@company.com"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="venue-manager">Venue manager</Label>
                  {managerCustom ? (
                    <div className="flex flex-col gap-1.5">
                      <Input
                        id="venue-manager"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        placeholder="e.g. Jamie Doyle"
                      />
                      {staffOptions.length > 0 && (
                        <button
                          type="button"
                          className="self-start text-xs text-brand hover:underline"
                          onClick={() => {
                            setManagerCustom(false)
                            setManagerName("")
                          }}
                        >
                          Choose from team instead
                        </button>
                      )}
                    </div>
                  ) : (
                    <Select
                      value={managerName || ""}
                      onValueChange={(v) => {
                        if (v === CUSTOM_MANAGER) {
                          setManagerCustom(true)
                          setManagerName("")
                        } else {
                          setManagerName(v ?? "")
                        }
                      }}
                    >
                      <SelectTrigger id="venue-manager">
                        <SelectValue placeholder={staffOptions.length ? "Select a team member" : "No team members yet"} />
                      </SelectTrigger>
                      <SelectContent>
                        {staffOptions.map((m) => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name} · {m.role}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_MANAGER}>Enter a different name…</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {mode === "add" && (
                    <p className="text-xs text-muted-foreground">
                      Add team members after creating the venue to assign a manager from your team.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {/* Opening hours */}
            <section className="grid gap-4">
              <h3 className="text-sm font-semibold text-foreground">Opening hours</h3>
              <ul className="grid gap-2">
                {hours.map((h) => (
                  <li
                    key={h.day}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <span className="w-10 text-sm font-medium text-foreground">{h.day}</span>
                    {h.closed ? (
                      <span className="flex-1 text-sm text-muted-foreground">Closed</span>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          type="time"
                          value={h.open}
                          onChange={(e) => setDay(h.day, { open: e.target.value })}
                          className="w-auto"
                          aria-label={`${h.day} opening time`}
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={h.close}
                          onChange={(e) => setDay(h.day, { close: e.target.value })}
                          className="w-auto"
                          aria-label={`${h.day} closing time`}
                        />
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={h.closed}
                        onCheckedChange={(c) => setDay(h.day, { closed: c === true })}
                      />
                      Closed
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <Separator />

            {/* Notes */}
            <section className="grid gap-2">
              <Label htmlFor="venue-notes">Internal notes</Label>
              <Textarea
                id="venue-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the team should know about this venue..."
                rows={3}
              />
            </section>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : mode === "add" ? "Add venue" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
