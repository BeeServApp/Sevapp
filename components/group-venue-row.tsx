"use client"

import { useRouter } from "next/navigation"
import { MapPin, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVenue } from "@/components/venue-provider"

export function GroupVenueRow({
  id,
  name,
  location,
  weekRevenue,
  monthRevenue,
  gpPct,
  openTasks,
}: {
  id: number
  name: string
  location: string
  weekRevenue: string
  monthRevenue: string
  gpPct: string
  openTasks: number
}) {
  const router = useRouter()
  const { switchVenue } = useVenue()

  function openVenue() {
    switchVenue(id)
    router.push("/dashboard")
  }

  return (
    <tr className="hover:bg-secondary/50">
      <td className="py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <MapPin className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{location}</p>
          </div>
        </div>
      </td>
      <td className="py-3 text-right font-medium tabular-nums text-foreground">{weekRevenue}</td>
      <td className="py-3 text-right tabular-nums text-muted-foreground">{monthRevenue}</td>
      <td className="py-3 text-right tabular-nums text-muted-foreground">{gpPct}</td>
      <td className="py-3 text-right tabular-nums text-muted-foreground">{openTasks}</td>
      <td className="py-3 text-right">
        <Button variant="ghost" size="sm" className="gap-1" onClick={openVenue}>
          View <ArrowRight className="size-4" />
        </Button>
      </td>
    </tr>
  )
}
