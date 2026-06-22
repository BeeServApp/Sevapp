"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell, ChevronDown, ChevronRight } from "lucide-react"
import { selfClock } from "@/app/actions/staff"
import { PortalFilterBar } from "@/components/portal/portal-filter-bar"
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
    <div>
      {/* Top bar: venue + notifications */}
      <header className="flex items-center justify-between gap-3 py-3">
        <button type="button" className="flex items-center gap-1.5 text-left">
          <span className="text-2xl font-bold tracking-tight text-foreground">{venueName || firstName}</span>
          <ChevronDown className="size-5 text-foreground" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
        >
          <Bell className="size-5" />
        </button>
      </header>

      <hr className="-mx-5 border-border" />

      {/* Next shift */}
      <section className="py-6">
        <h2 className="text-lg font-bold text-foreground">Next shift</h2>
        {nextShift ? (
          <div className="mt-2">
            <p className="text-4xl font-bold leading-tight tracking-tight text-foreground">
              {nextShift.relLabel}
              <br />
              {nextShift.startTime} – {nextShift.endTime}
            </p>
            <p className="mt-2 text-base text-muted-foreground">
              {nextShift.role || "Shift"} · {nextShift.venueName}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-base text-muted-foreground">No upcoming shifts scheduled.</p>
        )}

        <button
          type="button"
          onClick={handleClock}
          disabled={working}
          className={cn(
            "mt-6 w-full rounded-full py-4 text-center text-lg font-bold transition-colors disabled:opacity-60",
            clockState === "in"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-foreground hover:bg-muted/70",
          )}
        >
          {working ? "Please wait…" : clockState === "in" ? "Clock out" : "Clock in"}
        </button>
      </section>

      <hr className="-mx-5 border-[6px] border-muted" />

      {/* My week */}
      <section className="pt-6">
        <h2 className="text-lg font-bold text-foreground">My week</h2>
        <PortalFilterBar weekStart={weekStart} showFilters={false} />

        <ul className="mt-2">
          {rows.map((row, i) => (
            <li
              key={row.label}
              className={cn(
                "flex items-center justify-between py-4",
                i < rows.length - 1 && "border-b border-border",
              )}
            >
              <span className="text-base font-semibold text-foreground">{row.label}</span>
              <span className="flex items-center gap-1.5">
                <span className="text-base font-semibold tabular-nums text-foreground">{row.value}</span>
                {row.chevron ? <ChevronRight className="size-5 text-muted-foreground" /> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
