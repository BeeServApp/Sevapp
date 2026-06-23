"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, CalendarClock } from "lucide-react"
import { selfClock } from "@/app/actions/staff"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalFilterBar } from "@/components/portal/portal-filter-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { formatMoney } from "@/lib/rota"
import { cn } from "@/lib/utils"
import type { HomeData } from "@/app/actions/portal"

/** Long-form hours label, e.g. "30 hrs", "0 min", "7h 30m". */
function formatHoursLong(hours: number): string {
  if (hours <= 0) return "0 min"
  const whole = Math.floor(hours)
  const mins = Math.round((hours - whole) * 60)
  if (mins === 0) return `${whole} hr${whole === 1 ? "" : "s"}`
  if (whole === 0) return `${mins} min`
  return `${whole}h ${mins}m`
}

function getCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

export function HomeView({ data }: { data: HomeData }) {
  const router = useRouter()
  const { firstName, venueName, weekStart, nextShift, stats } = data
  const [clockState, setClockState] = useState<"in" | "out">(data.clockState)
  const [working, setWorking] = useState(false)
  const [, startTransition] = useTransition()

  async function handleClock() {
    setWorking(true)
    try {
      const type = clockState === "in" ? "out" : "in"
      const coords = await getCoords()
      await selfClock(type, coords)
      setClockState(type)
      startTransition(() => router.refresh())
    } finally {
      setWorking(false)
    }
  }

  const rows: { label: string; value: string; chevron: boolean }[] = [
    { label: "Hours scheduled", value: formatHoursLong(stats.hoursScheduled), chevron: true },
    { label: "Hours worked", value: formatHoursLong(stats.hoursWorked), chevron: true },
    { label: "Tips earned", value: formatMoney(stats.tipsPence), chevron: true },
    { label: "Estimated earnings", value: formatMoney(stats.estimatedEarningsPence), chevron: true },
    { label: "Commissions earned", value: formatMoney(stats.commissionsPence), chevron: false },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PortalHeader title={`Hi, ${firstName}`} description={venueName || undefined} />

      {/* Next shift */}
      <Card>
        <CardHeader>
          <CardTitle>Next shift</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {nextShift ? (
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CalendarClock className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-tight tracking-tight text-foreground">
                  {nextShift.relLabel}, {nextShift.startTime} – {nextShift.endTime}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nextShift.role || "Shift"} · {nextShift.venueName}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming shifts scheduled.</p>
          )}

          <button
            type="button"
            onClick={handleClock}
            disabled={working}
            className={cn(
              buttonVariants({ variant: clockState === "in" ? "default" : "secondary", size: "lg" }),
              "w-full",
            )}
          >
            {working ? "Please wait…" : clockState === "in" ? "Clock out" : "Clock in"}
          </button>
        </CardContent>
      </Card>

      {/* My week */}
      <Card>
        <CardHeader>
          <CardTitle>My week</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalFilterBar weekStart={weekStart} showFilters={false} />
          <ul className="mt-1">
            {rows.map((row, i) => (
              <li
                key={row.label}
                className={cn(
                  "flex items-center justify-between py-3",
                  i < rows.length - 1 && "border-b border-border",
                )}
              >
                <span className="text-sm font-medium text-foreground">{row.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{row.value}</span>
                  {row.chevron ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
