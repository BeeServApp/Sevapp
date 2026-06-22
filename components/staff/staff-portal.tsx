"use client"

import { useMemo, useState } from "react"
import { Clock, MapPin, LogIn, LogOut, CalendarDays, Coffee, StickyNote } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { selfClock } from "@/app/actions/staff"
import type { DbRotaShift } from "@/lib/db/schema"
import { colorClasses, shiftHours, formatHours, timeLabel } from "@/lib/rota"
import { cn } from "@/lib/utils"

interface Props {
  name: string
  weekStart: string
  rotaDays: string[]
  initialShifts: DbRotaShift[]
  staffMemberId: number | null
}

const DAY_ORDER: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

export function StaffPortal({ name, weekStart, rotaDays, initialShifts }: Props) {
  const [shifts] = useState<DbRotaShift[]>(initialShifts)
  const [clockState, setClockState] = useState<"out" | "in">("out")
  const [working, setWorking] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const sortedShifts = useMemo(
    () => [...shifts].sort((a, b) => (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9)),
    [shifts],
  )

  const totalHours = useMemo(
    () => shifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins), 0),
    [shifts],
  )

  // Today's shift (best-effort: match weekday short name).
  const todayName = new Date().toLocaleDateString("en-GB", { weekday: "short" })
  const nextShift = useMemo(() => {
    const today = sortedShifts.find((s) => s.day === todayName)
    if (today) return today
    const todayIdx = DAY_ORDER[todayName] ?? 0
    return sortedShifts.find((s) => (DAY_ORDER[s.day] ?? 9) >= todayIdx) ?? sortedShifts[0] ?? null
  }, [sortedShifts, todayName])

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

  async function handleClock(type: "in" | "out") {
    setWorking(true)
    setFeedback(null)
    try {
      const coords = await getCoords()
      await selfClock(type, coords)
      setClockState(type === "in" ? "in" : "out")
      setFeedback(
        type === "in"
          ? `Clocked in${coords ? " with GPS location" : ""}.`
          : `Clocked out${coords ? " with GPS location" : ""}.`,
      )
    } catch {
      setFeedback("Could not record clock event. Try again.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <PageHeader
        title={`Hi, ${name.split(" ")[0]}`}
        description={`Your schedule for the week of ${weekStart}.`}
      />

      {/* Clock in / out */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                clockState === "in" ? "bg-chart-2/15 text-chart-2" : "bg-muted text-muted-foreground",
              )}
            >
              <Clock className="size-6" />
            </div>
            <div>
              <div className="font-semibold text-foreground">
                {clockState === "in" ? "You're on shift" : "You're clocked out"}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> GPS captured automatically when available
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={working || clockState === "out"}
              onClick={() => handleClock("out")}
            >
              <LogOut className="size-4" /> Clock out
            </Button>
            <Button disabled={working || clockState === "in"} onClick={() => handleClock("in")}>
              <LogIn className="size-4" /> Clock in
            </Button>
          </div>
        </CardContent>
        {feedback && (
          <div className="border-t border-border px-5 py-2 text-xs font-medium text-muted-foreground">
            {feedback}
          </div>
        )}
      </Card>

      {/* Next shift */}
      {nextShift ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next shift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-12 flex-col items-center justify-center rounded-lg border",
                  colorClasses(nextShift.color).block,
                )}
              >
                <span className="text-[10px] font-medium uppercase">{nextShift.day}</span>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{nextShift.role || "Shift"}</div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {timeLabel(nextShift.startTime, nextShift.endTime, nextShift.shiftTime)}
                  </span>
                  {nextShift.breakMins ? (
                    <span className="inline-flex items-center gap-1">
                      <Coffee className="size-3.5" /> {nextShift.breakMins}m break
                    </span>
                  ) : null}
                </div>
                {nextShift.notes ? (
                  <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                    <StickyNote className="mt-0.5 size-3 shrink-0" /> {nextShift.notes}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* My week */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">My week</CardTitle>
          <Badge variant="outline">{formatHours(totalHours)} scheduled</Badge>
        </CardHeader>
        <CardContent>
          {sortedShifts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <CalendarDays className="size-8 opacity-40" />
              <p className="text-sm">No published shifts for this week yet.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rotaDays.map((day) => {
                const dayShifts = sortedShifts.filter((s) => s.day === day)
                return (
                  <li
                    key={day}
                    className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="w-10 shrink-0 text-sm font-medium text-muted-foreground">{day}</div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      {dayShifts.length === 0 ? (
                        <span className="text-sm text-muted-foreground/50">Off</span>
                      ) : (
                        dayShifts.map((s) => {
                          const cc = colorClasses(s.color)
                          return (
                            <div
                              key={s.id}
                              className={cn("rounded-md border px-2.5 py-1.5 text-sm", cc.block)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{s.role || "Shift"}</span>
                                <span className="text-xs opacity-80">
                                  {formatHours(shiftHours(s.startTime, s.endTime, s.breakMins))}
                                </span>
                              </div>
                              <div className="text-xs opacity-80">
                                {timeLabel(s.startTime, s.endTime, s.shiftTime)}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
