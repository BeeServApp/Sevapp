import { ChevronRight, Plus } from "lucide-react"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalFilterBar } from "@/components/portal/portal-filter-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { shiftHours, formatHours, timeLabel } from "@/lib/rota"
import { cn } from "@/lib/utils"
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
            className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground"
          >
            <Plus className="size-4" />
          </span>
        }
      />
      <PortalFilterBar weekStart={weekStart} locationLabel={venueName || "All"} />

      {daysWithShifts.length === 0 ? (
        <Card className="mt-2">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-base font-medium text-foreground">No shifts this week</p>
            <p className="text-sm text-muted-foreground">
              There are no published shifts for the selected week.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          {daysWithShifts.map((day) => {
            const dayShifts = byDay.get(day)!
            return (
              <Card key={day}>
                <CardHeader>
                  <CardTitle>{dayHeading(dayShifts[0].dateISO, day)}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                  {dayShifts.map((s, i) => {
                    const hours = shiftHours(s.startTime, s.endTime, s.breakMins)
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center gap-3 py-3",
                          i < dayShifts.length - 1 && "border-b border-border",
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                          {initialsOf(s.staffName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">
                            {timeLabel(s.startTime, s.endTime, s.shiftTime)}{" "}
                            <span className="text-muted-foreground">({formatHours(hours)})</span>
                          </div>
                          <div className="truncate text-sm text-muted-foreground">
                            {s.isMe ? "You" : s.staffName}
                            {s.role ? ` · ${s.role}` : ""}
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
