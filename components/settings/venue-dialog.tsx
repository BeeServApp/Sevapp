"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { VenueSummary } from "@/components/venue-provider"

const venueTypes = ["Pub", "Bar", "Restaurant", "Hotel", "Cafe", "Nightclub", "Brewery"]

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
  const [address, setAddress] = useState(venue?.address ?? "")
  const [city, setCity] = useState(venue?.city ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    if (mode === "add") {
      setName("")
      setType("Pub")
      setAddress("")
      setCity("")
    }
    setError(null)
    setSaving(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Venue name is required.")
    setSaving(true)
    setError(null)
    try {
      if (mode === "add") {
        await createVenue({ name, type, address, city })
      } else if (venue) {
        await updateVenue(venue.id, { name, type, address, city })
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
        if (!o) reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add venue" : "Edit venue"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Create a new venue to manage its operations and assets."
              : "Update the details for this venue."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
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
              placeholder="e.g. Bristol, UK"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
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
