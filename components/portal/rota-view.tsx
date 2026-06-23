"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, CalendarPlus } from "lucide-react"
import { requestSwap, requestClaim } from "@/app/actions/scheduling"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalFilterBar } from "@/components/portal/portal-filter-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { shiftHours, formatHours, timeLabel } from "@/lib/rota"
import { cn } from "@/lib/utils"
import type { TeamShift, OpenShift, RotaData } from "@/app/actions/portal"

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

const SWAP_LABEL: Record<string, string> = {
  claim: "Claim open shift",
  drop: "Drop shift",
  swap: "Swap shift",
}

const SWAP_STATUS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
}

export function RotaView({
  weekStart,
  venueName,
  shifts,
  openShifts,
  mySwaps,
  teammates,
}: {
  weekStart: string
  venueName: string
  shifts: TeamShift[]
  openShifts: OpenShift[]
  mySwaps: RotaData["mySwaps"]
  teammates: RotaData["teammates"]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Action dialog state for one of the user's own shifts.
  const [active, setActive] = useState<TeamShift | null>(null)
  const [mode, setMode] = useState<"drop" | "swap">("drop")
  const [targetStaffId, setTargetStaffId] = useState<string>("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [claiming, setClaiming] = useState<number | null>(null)

  // Shift ids that already have a pending request by me — block duplicates.
  const pendingByShift = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of mySwaps) {
      if (s.status === "pending") m.set(s.shiftId, s.type)
    }
    return m
  }, [mySwaps])

  const byDay = new Map<string, TeamShift[]>()
  for (const s of shifts) {
    if (!byDay.has(s.day)) byDay.set(s.day, [])
    byDay.get(s.day)!.push(s)
  }
  const daysWithShifts = DAY_ORDER.filter((d) => byDay.has(d))

  function openAction(shift: TeamShift) {
    setActive(shift)
    setMode("drop")
    setTargetStaffId("")
    setNote("")
    setError(null)
  }

  async function submitAction() {
    if (!active) return
    if (mode === "swap" && !targetStaffId) {
      setError("Choose a teammate to swap with.")
      return
    }
    setError(null)
    setSaving(true)
    try {
      await requestSwap({
        shiftId: active.id,
        type: mode,
        targetStaffId: mode === "swap" ? Number(targetStaffId) : null,
        note: note.trim() || null,
      })
      setActive(null)
      startTransition(() => router.refresh())
    } catch {
      setError("Could not submit your request. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function claim(shiftId: number) {
    setClaiming(shiftId)
    try {
      await requestClaim(shiftId)
      startTransition(() => router.refresh())
    } finally {
      setClaiming(null)
    }
  }

  const visibleRequests = mySwaps.slice(0, 6)

  return (
    <div>
      <PortalHeader title="Rota" description={venueName || undefined} />
      <PortalFilterBar weekStart={weekStart} locationLabel={venueName || "All"} />

      {/* My pending / recent requests */}
      {visibleRequests.length > 0 && (
        <Card className="mt-2">
          <CardHeader>
            <CardTitle>My requests</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {visibleRequests.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center justify-between gap-3 py-3",
                  i < visibleRequests.length - 1 && "border-b border-border",
                )}
              >
                <span className="text-sm font-medium text-foreground">{SWAP_LABEL[r.type] ?? "Request"}</span>
                <StatusBadge status={SWAP_STATUS[r.status] ?? r.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Open shifts available to claim */}
      {openShifts.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Open shifts</CardTitle>
            <p className="text-sm text-muted-foreground">Available shifts you can request to pick up.</p>
          </CardHeader>
          <CardContent className="flex flex-col">
            {openShifts.map((s, i) => {
              const hours = shiftHours(s.startTime, s.endTime, s.breakMins)
              const requested = pendingByShift.has(s.id)
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    i < openShifts.length - 1 && "border-b border-border",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-chart-3/10 text-chart-3">
                    <CalendarPlus className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {dayHeading(s.dateISO, s.day)} · {timeLabel(s.startTime, s.endTime, s.shiftTime)}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {formatHours(hours)}
                      {s.role ? ` · ${s.role}` : ""}
                    </div>
                  </div>
                  {requested ? (
                    <StatusBadge status="Pending" />
                  ) : (
                    <Button size="sm" variant="secondary" disabled={claiming === s.id} onClick={() => claim(s.id)}>
                      {claiming === s.id ? "…" : "Request"}
                    </Button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {daysWithShifts.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-base font-medium text-foreground">No shifts this week</p>
            <p className="text-sm text-muted-foreground">There are no published shifts for the selected week.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
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
                    const pendingType = pendingByShift.get(s.id)
                    const actionable = s.isMe && !pendingType
                    const Wrapper = actionable ? "button" : "div"
                    return (
                      <Wrapper
                        key={s.id}
                        type={actionable ? "button" : undefined}
                        onClick={actionable ? () => openAction(s) : undefined}
                        className={cn(
                          "flex items-center gap-3 py-3 text-left",
                          i < dayShifts.length - 1 && "border-b border-border",
                          actionable && "transition-colors active:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
                            s.isMe ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                          )}
                        >
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
                        {pendingType ? (
                          <StatusBadge status="Pending" />
                        ) : actionable ? (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        ) : null}
                      </Wrapper>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Drop / swap action dialog */}
      <Dialog open={active != null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your shift</DialogTitle>
            <DialogDescription>
              {active
                ? `${dayHeading(active.dateISO, active.day)} · ${timeLabel(active.startTime, active.endTime, active.shiftTime)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="swap-mode">Request type</Label>
              <Select value={mode} onValueChange={(v) => setMode((v as "drop" | "swap") ?? mode)}>
                <SelectTrigger id="swap-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drop">Drop this shift</SelectItem>
                  <SelectItem value="swap">Swap with a teammate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "swap" && (
              <div className="grid gap-2">
                <Label htmlFor="swap-target">Swap with</Label>
                <Select value={targetStaffId} onValueChange={(v) => setTargetStaffId(v ?? "")}>
                  <SelectTrigger id="swap-target">
                    <SelectValue placeholder={teammates.length ? "Select teammate" : "No teammates available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {teammates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Your manager will review this request before anything changes on the rota.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitAction} disabled={saving}>
              {saving ? "Submitting…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
