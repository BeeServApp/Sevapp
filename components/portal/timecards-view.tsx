"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Clock, Plus } from "lucide-react"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalFilterBar } from "@/components/portal/portal-filter-bar"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { shiftHours, formatHours } from "@/lib/rota"
import { cn } from "@/lib/utils"
import type { DbTimecard } from "@/lib/db/schema"

function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
}

export function TimecardsView({ weekStart, timecards }: { weekStart: string; timecards: DbTimecard[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function reload() {
    startTransition(() => router.refresh())
  }

  return (
    <div>
      <PortalHeader
        title="Timecards"
        action={
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Plus className="size-5" />
          </span>
        }
      />
      <PortalFilterBar weekStart={weekStart} />

      {timecards.length === 0 ? (
        <Card className="mt-2">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="mb-1 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-8" />
            </span>
            <h2 className="text-pretty text-lg font-semibold text-foreground">
              No timecards in this time range
            </h2>
            <p className="max-w-xs text-pretty text-sm text-muted-foreground">
              There are no timecards in the timeframe you have selected.
            </p>
            <button
              type="button"
              onClick={reload}
              disabled={pending}
              className={cn(buttonVariants({ size: "lg" }), "mt-4")}
            >
              {pending ? "Reloading…" : "Reload"}
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-2">
          <CardContent className="flex flex-col">
            {timecards.map((tc, i) => {
              const worked = tc.clockIn && tc.clockOut ? shiftHours(tc.clockIn, tc.clockOut, tc.breakMins) : 0
              const approved = tc.status === "approved"
              return (
                <div
                  key={tc.id}
                  className={cn(
                    "flex items-center justify-between gap-3 py-3",
                    i < timecards.length - 1 && "border-b border-border",
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{prettyDate(tc.dateISO)}</div>
                    <div className="text-sm text-muted-foreground">
                      {tc.clockIn ?? "--"} – {tc.clockOut ?? "--"}
                      {tc.breakMins ? ` · ${tc.breakMins}m break` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatHours(worked)}
                    </span>
                    <StatusBadge status={approved ? "Approved" : "Open"} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
