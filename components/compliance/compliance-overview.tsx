"use client"

import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"
import type { ComplianceScore, Notification } from "@/app/actions/safety"

function ScoreRing({ value }: { value: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const tone = value >= 90 ? "text-chart-2" : value >= 70 ? "text-chart-4" : "text-destructive"

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
        <span className="text-xs text-muted-foreground">compliant</span>
      </div>
    </div>
  )
}

export function ComplianceOverview({
  score,
  notifications,
  counts,
  onJumpToTab,
}: {
  score: ComplianceScore
  notifications: Notification[]
  counts: {
    overdueRecords: number
    expiringCerts: number
    openActions: number
    checklistsDueToday: number
  }
  onJumpToTab: (tab: string) => void
}) {
  const urgent = notifications.filter((n) => n.severity === "danger").slice(0, 6)
  const rating = score.overall >= 90 ? "Excellent" : score.overall >= 70 ? "Good" : score.overall >= 50 ? "Needs work" : "At risk"

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Score card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-chart-2" /> Compliance score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <ScoreRing value={score.overall} />
            <p className="text-sm font-medium">{rating}</p>
            <p className="text-center text-xs text-muted-foreground text-pretty">
              Calculated live across every safety module from your current records.
            </p>
          </CardContent>
        </Card>

        {/* Module breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Module breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {score.modules.map((m) => (
              <div key={m.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground">
                    {m.total === 0 ? "No items" : `${m.ok}/${m.total} healthy`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      m.score >= 90 ? "bg-chart-2" : m.score >= 70 ? "bg-chart-4" : "bg-destructive",
                    )}
                    style={{ width: `${m.score}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QuickTile
          label="Overdue records"
          value={counts.overdueRecords}
          tone={counts.overdueRecords > 0 ? "danger" : "ok"}
          onClick={() => onJumpToTab("fire")}
        />
        <QuickTile
          label="Certs expiring"
          value={counts.expiringCerts}
          tone={counts.expiringCerts > 0 ? "warning" : "ok"}
          onClick={() => onJumpToTab("records")}
        />
        <QuickTile
          label="Open actions"
          value={counts.openActions}
          tone={counts.openActions > 0 ? "warning" : "ok"}
          onClick={() => onJumpToTab("audits")}
        />
        <QuickTile
          label="Checklists due today"
          value={counts.checklistsDueToday}
          tone={counts.checklistsDueToday > 0 ? "info" : "ok"}
          onClick={() => onJumpToTab("checklists")}
        />
      </div>

      {/* Urgent attention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> Needs attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {urgent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing urgent. You&apos;re on top of compliance.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {urgent.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={n.severity === "danger" ? "Overdue" : "Due"} />
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => onJumpToTab(n.tab)}>
                      <ArrowRight className="size-4" />
                      <span className="sr-only">Go to {n.title}</span>
                    </Button>
                  </div>
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
