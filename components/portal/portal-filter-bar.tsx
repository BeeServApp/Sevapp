"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, MapPin, SlidersHorizontal } from "lucide-react"
import { addWeeks, dateForDay } from "@/lib/rota"
import { cn } from "@/lib/utils"

interface PortalFilterBarProps {
  weekStart: string
  /** Location label shown in the pill (e.g. venue name or "All"). */
  locationLabel?: string
  /** Hide the location + filter controls (used where they're not relevant). */
  showFilters?: boolean
}

function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export function PortalFilterBar({ weekStart, locationLabel = "All", showFilters = true }: PortalFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  // Sunday = Monday + 6 days (timezone-safe via the shared helper).
  const endISO = dateForDay(weekStart, "Sun")

  function goToWeek(offset: number) {
    const next = addWeeks(weekStart, offset)
    const sp = new URLSearchParams(params.toString())
    sp.set("week", next)
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex flex-1 items-center justify-between rounded-lg border border-border bg-background px-1.5 py-1">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => goToWeek(-1)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="px-1 text-sm font-medium tabular-nums text-foreground">
          {ddmmyyyy(weekStart)} – {ddmmyyyy(endISO)}
        </span>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => goToWeek(1)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {showFilters ? (
        <>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground",
            )}
          >
            <MapPin className="size-4 text-muted-foreground" />
            <span className="max-w-24 truncate">{locationLabel}</span>
          </div>
          <button
            type="button"
            aria-label="Filters"
            className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </>
      ) : null}
    </div>
  )
}
