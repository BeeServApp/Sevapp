"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Plus, Pencil, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VenueDialog } from "@/components/settings/venue-dialog"
import { deleteVenue, setActiveVenue } from "@/app/actions/venues"
import type { VenueSummary } from "@/components/venue-provider"

export function VenuesSettings({
  venues,
  activeVenueId,
}: {
  venues: VenueSummary[]
  activeVenueId: number | null
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function handleDelete(id: number) {
    if (!confirm("Delete this venue and all of its assets and team members? This cannot be undone.")) {
      return
    }
    setBusyId(id)
    try {
      await deleteVenue(id)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete venue.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleSetActive(id: number) {
    setBusyId(id)
    try {
      await setActiveVenue(id)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Venues</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the venues in your group and switch the active one.
          </p>
        </div>
        <VenueDialog
          mode="add"
          trigger={
            <Button className="gap-1.5">
              <Plus className="size-4" /> Add venue
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {venues.map((v) => {
            const isActive = v.id === activeVenueId
            return (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <MapPin className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{v.name}</p>
                    {isActive && (
                      <Badge variant="outline" className="border-transparent bg-brand/15 text-xs text-brand">
                        Active
                      </Badge>
                    )}
                    {v.status && v.status !== "Active" && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {v.status}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {[
                      v.type,
                      v.city,
                      v.capacity != null ? `Cap. ${v.capacity}` : null,
                      v.managerName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === v.id}
                      onClick={() => handleSetActive(v.id)}
                    >
                      <Check className="size-4" /> Set active
                    </Button>
                  )}
                  <VenueDialog
                    mode="edit"
                    venue={v}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${v.name}`}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${v.name}`}
                    disabled={busyId === v.id || venues.length <= 1}
                    onClick={() => handleDelete(v.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
