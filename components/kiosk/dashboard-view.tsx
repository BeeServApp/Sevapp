"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Loader2, ListChecks, TimerOff, UserCheck } from "lucide-react"
import { getKioskDashboard } from "@/app/actions/kiosk"
import { ScoreGauge } from "@/components/kiosk/score-gauge"

type Dashboard = Awaited<ReturnType<typeof getKioskDashboard>>

const REFRESH_MS = 30000

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Clock
  label: string
  value: string
  tone?: "default" | "warn" | "bad"
}) {
  const toneClass =
    tone === "bad"
      ? "text-destructive"
      : tone === "warn"
        ? "text-status-near"
        : "text-foreground"
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

export function DashboardView() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const d = await getKioskDashboard()
        if (active) setData(d)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  }
  if (!data) return null

  const { score } = data

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
      {/* Score gauge */}
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-card p-6 ring-1 ring-border">
        <ScoreGauge score={score.score} />
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-lg font-semibold tabular-nums">{score.taskScore}/60</div>
            <div className="text-xs text-muted-foreground">Tasks</div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums">{score.punctualityScore}/40</div>
            <div className="text-xs text-muted-foreground">Punctuality</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          icon={ListChecks}
          label="Tasks completed today"
          value={`${data.tasksCompleted}/${data.tasksTotal}`}
        />
        <StatCard
          icon={TimerOff}
          label="Tasks overdue"
          value={String(score.tasksOverdue)}
          tone={score.tasksOverdue > 0 ? "bad" : "default"}
        />
        <StatCard
          icon={Clock}
          label="Late clock-ins"
          value={String(score.lateClockIns)}
          tone={score.lateClockIns > 0 ? "warn" : "default"}
        />
        <StatCard
          icon={UserCheck}
          label="On shift now"
          value={String(data.clockedIn.length)}
        />
      </div>

      {/* Who's clocked in */}
      <div className="rounded-3xl bg-card p-5 ring-1 ring-border lg:col-span-2">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <UserCheck className="size-4" /> Clocked in
        </h2>
        {data.clockedIn.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one is clocked in yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.clockedIn.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
              >
                <CheckCircle2 className="size-4" />
                {s.name}
                <span className="text-xs font-normal text-primary/70">
                  since {new Date(s.since).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
