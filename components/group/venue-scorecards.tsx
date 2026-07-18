"use client"

import { useRouter } from "next/navigation"
import { CheckCircle2, Clock, AlertTriangle, ListChecks } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useVenue } from "@/components/venue-provider"
import type { VenueScoreRow } from "@/app/actions/group"

// Score bands map to the theme's chart palette (no green token exists, so a
// confident blue stands in for "good", amber for "watch", red for "act now").
function band(score: number) {
  if (score >= 85) return { ring: "var(--chart-2)", text: "text-chart-2", label: "On track" }
  if (score >= 70) return { ring: "var(--chart-4)", text: "text-chart-4", label: "Watch" }
  return { ring: "var(--destructive)", text: "text-destructive", label: "Needs attention" }
}

function ScoreRing({ score }: { score: number }) {
  const b = band(score)
  return (
    <div
      className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${b.ring} ${score * 3.6}deg, var(--muted) 0deg)`,
      }}
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <div className="flex size-12 flex-col items-center justify-center rounded-full bg-card">
        <span className={cn("text-lg font-semibold tabular-nums leading-none", b.text)}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("size-3.5", tone === "warn" ? "text-destructive" : "text-muted-foreground")} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

function VenueScoreCard({ row, clickable }: { row: VenueScoreRow; clickable: boolean }) {
  const router = useRouter()
  const { switchVenue } = useVenue()
  const s = row.score
  const b = band(s.score)

  function open() {
    if (!clickable) return
    switchVenue(row.venueId)
    router.push("/dashboard")
  }

  return (
    <Card
      className={cn(
        "gap-0 p-5",
        clickable && "cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/30",
      )}
      onClick={open}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          open()
        }
      }}
    >
      <div className="flex items-center gap-4">
        <ScoreRing score={s.score} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.location}</p>
          <span className={cn("mt-1 inline-block text-xs font-medium", b.text)}>{b.label}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-sm">
        <Metric
          icon={ListChecks}
          label="Tasks done"
          value={`${s.tasksCompleted}/${s.tasksTotal}`}
        />
        {s.tasksOverdue > 0 && (
          <Metric icon={AlertTriangle} label="Overdue tasks" value={String(s.tasksOverdue)} tone="warn" />
        )}
        <Metric
          icon={Clock}
          label="Punctuality"
          value={`${Math.round((s.punctualityScore / 40) * 100)}%`}
        />
        {s.missedClockIns > 0 && (
          <Metric icon={AlertTriangle} label="Not clocked in" value={String(s.missedClockIns)} tone="warn" />
        )}
      </div>
    </Card>
  )
}

export function VenueScorecards({
  rows,
  clickable = false,
}: {
  rows: VenueScoreRow[]
  clickable?: boolean
}) {
  if (rows.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <CheckCircle2 className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No venue scores yet</p>
          <p className="text-sm text-muted-foreground">
            Scores appear once tasks and rotas are set up for your venues.
          </p>
        </div>
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <VenueScoreCard key={row.venueId} row={row} clickable={clickable} />
      ))}
    </div>
  )
}
