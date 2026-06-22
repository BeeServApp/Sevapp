"use client"

import { AlertTriangle, ArrowRight, UtensilsCrossed } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FoodScore, FoodAlert } from "@/app/actions/food"

function ScoreRing({ value }: { value: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const tone = value >= 90 ? "text-chart-2" : value >= 75 ? "text-chart-4" : "text-destructive"

  return (
    <div className="relative flex size-36 items-center justify-center">
      <svg className="size-36 -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-700", tone)}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-heading text-3xl font-bold">{value}%</span>
        <span className="text-xs text-muted-foreground">today</span>
      </div>
    </div>
  )
}

export function FoodOverview({
  score,
  alerts,
  onJumpToTab,
}: {
  score: FoodScore
  alerts: FoodAlert[]
  onJumpToTab: (tab: string) => void
}) {
  const severityToClass = (s: FoodAlert["severity"]) =>
    s === "high" ? "text-destructive" : s === "medium" ? "text-chart-4" : "text-muted-foreground"

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-chart-2" /> Food safety score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <ScoreRing value={score.score} />
            <p className="text-sm font-medium">{score.label}</p>
            <p className="text-center text-xs text-muted-foreground text-pretty">
              {score.passedToday}/{score.dueToday} checks passed today.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today by area</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {score.areas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No checks set up yet. Add HACCP checks to start scoring.
              </p>
            ) : (
              score.areas.map((a) => {
                const pct = a.total === 0 ? 0 : Math.round((a.done / a.total) * 100)
                const failed = a.failed > 0
                return (
                  <div key={a.area} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{a.area}</span>
                      <span className={cn("text-muted-foreground", failed && "text-destructive")}>
                        {failed ? `${a.failed} failed` : `${a.done}/${a.total} logged`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          failed ? "bg-destructive" : pct === 100 ? "bg-chart-2" : "bg-chart-4",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QuickTile label="Checks due today" value={score.dueToday} tone="info" onClick={() => onJumpToTab("checks")} />
        <QuickTile label="Completed" value={score.completedToday} tone="ok" onClick={() => onJumpToTab("checks")} />
        <QuickTile
          label="Failed checks"
          value={score.failedToday}
          tone={score.failedToday > 0 ? "danger" : "ok"}
          onClick={() => onJumpToTab("checks")}
        />
        <QuickTile
          label="Outstanding"
          value={score.dueToday - score.completedToday}
          tone={score.dueToday - score.completedToday > 0 ? "warning" : "ok"}
          onClick={() => onJumpToTab("checks")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> Needs attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              All checks logged and passing. Great work.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {alerts.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle className={cn("size-4 shrink-0", severityToClass(a.severity))} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => onJumpToTab("checks")}
                  >
                    <ArrowRight className="size-4" />
                    <span className="sr-only">Go to checks</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function QuickTile({
  label,
  value,
  tone,
  onClick,
}: {
  label: string
  value: number
  tone: "danger" | "warning" | "info" | "ok"
  onClick: () => void
}) {
  const toneClass = {
    danger: "text-destructive",
    warning: "text-chart-4",
    info: "text-chart-3",
    ok: "text-chart-2",
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-heading text-2xl font-bold", toneClass)}>{value}</span>
    </button>
  )
}
