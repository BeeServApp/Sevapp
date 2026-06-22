import { ChevronRight, Plus } from "lucide-react"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalFilterBar } from "@/components/portal/portal-filter-bar"
import { shiftHours, formatHours, timeLabel } from "@/lib/rota"
import type { TeamShift } from "@/app/actions/portal"

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function dayHeading(dateISO: string, day: string): string {
  const [, m, d] = dateISO.split("-")
  return `${day} ${d}/${m}`
}

export function RotaView({
  weekStart,
  venueName,
  shifts,
}: {
  weekStart: string
  venueName: string
  shifts: TeamShift[]
}) {
  const byDay = new Map<string, TeamShift[]>()
  for (const s of shifts) {
    if (!byDay.has(s.day)) byDay.set(s.day, [])
    byDay.get(s.day)!.push(s)
  }
  const daysWithShifts = DAY_ORDER.filter((d) => byDay.has(d))

  return (
    <div>
      <PortalHeader
        title="Rota"
        action={
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Plus className="size-5" />
          </span>
        }
      />
      <PortalFilterBar weekStart={weekStart} locationLabel={venueName || "All"} />

      {daysWithShifts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <p className="text-lg font-semibold text-foreground">No shifts this week</p>
          <p className="text-sm text-muted-foreground">There are no published shifts for the selected week.</p>
        </div>
      ) : (
        <div className="mt-2">
          {daysWithShifts.map((day) => {
            const dayShifts = byDay.get(day)!
            return (
              <section key={day} className="py-2">
                <h2 className="py-3 text-xl font-bold text-foreground">
                  {dayHeading(dayShifts[0].dateISO, day)}
                </h2>
                <ul className="flex flex-col">
                  {dayShifts.map((s) => {
                    const hours = shiftHours(s.startTime, s.endTime, s.breakMins)
                    return (
                      <li key={s.id} className="flex items-center gap-3 border-b border-border py-3">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                          {initialsOf(s.staffName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-bold text-foreground">
                            {timeLabel(s.startTime, s.endTime, s.shiftTime)}{" "}
                            <span className="font-bold">({formatHours(hours)})</span>
                          </div>
                          <div className="truncate text-sm text-muted-foreground">
                            {s.isMe ? "You" : s.staffName}
                            {s.role ? ` · ${s.role}` : ""}
                          </div>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
