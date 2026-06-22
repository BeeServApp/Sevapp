"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Clock, Plus, Check } from "lucide-react"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalFilterBar } from "@/components/portal/portal-filter-bar"
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
        <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
          <span className="mb-2 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-sky-500 ring-4 ring-foreground">
            <Clock className="size-12 text-background" strokeWidth={2.5} />
          </span>
          <h2 className="text-2xl font-bold text-foreground text-balance">No timecards in this time range</h2>
          <p className="max-w-xs text-base text-muted-foreground text-pretty">
            There are no timecards in the timeframe you have selected.
          </p>
          <button
            type="button"
            onClick={reload}
            disabled={pending}
            className="mt-6 rounded-full bg-foreground px-10 py-3.5 text-base font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
          >
            {pending ? "Reloading…" : "Reload"}
          </button>
        </div>
      ) : (
        <ul className="mt-2 flex flex-col">
          {timecards.map((tc) => {
            const worked = tc.clockIn && tc.clockOut ? shiftHours(tc.clockIn, tc.clockOut, tc.breakMins) : 0
            const approved = tc.status === "approved"
            return (
              <li key={tc.id} className="flex items-center justify-between gap-3 border-b border-border py-4">
                <div className="min-w-0">
                  <div className="text-base font-bold text-foreground">{prettyDate(tc.dateISO)}</div>
                  <div className="text-sm text-muted-foreground">
                    {tc.clockIn ?? "--"} – {tc.clockOut ?? "--"}
                    {tc.breakMins ? ` · ${tc.breakMins}m break` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold tabular-nums text-foreground">{formatHours(worked)}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                      approved ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {approved ? <Check className="size-3" /> : null}
                    {approved ? "Approved" : "Open"}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
