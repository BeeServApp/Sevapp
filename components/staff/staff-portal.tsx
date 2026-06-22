"use client"

import { useMemo, useRef, useState, useTransition, type Dispatch, type SetStateAction } from "react"
import {
  Clock,
  MapPin,
  LogIn,
  LogOut,
  CalendarDays,
  Coffee,
  StickyNote,
  ArrowLeftRight,
  Check,
  ListChecks,
  Camera,
  Loader2,
  Calendar,
  Repeat,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { selfClock } from "@/app/actions/staff"
import { setAvailability, requestSwap } from "@/app/actions/scheduling"
import { staffToggleTaskItem, staffUpdateTaskStatus, type TaskWithItems } from "@/app/actions/tasks"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { WeekNav } from "@/components/staff/week-nav"
import type { DbRotaShift, DbAvailability, DbShiftSwap, DbTimecard } from "@/lib/db/schema"
import {
  colorClasses,
  shiftHours,
  formatHours,
  formatMoney,
  timeLabel,
  weekRangeLabel,
} from "@/lib/rota"
import { cn } from "@/lib/utils"

interface Props {
  name: string
  weekStart: string
  rotaDays: string[]
  initialShifts: DbRotaShift[]
  initialAvailability: DbAvailability[]
  initialSwaps: DbShiftSwap[]
  initialTimecards: DbTimecard[]
  initialTasks: TaskWithItems[]
  staffMemberId: number | null
  venueId: number
}

const DAY_ORDER: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
const AVAIL_CYCLE = ["available", "preferred", "unavailable"] as const
type AvailStatus = (typeof AVAIL_CYCLE)[number]

const availStyles: Record<AvailStatus, { label: string; cls: string }> = {
  available: { label: "Available", cls: "bg-muted text-muted-foreground" },
  preferred: { label: "Prefer", cls: "bg-emerald-100 text-emerald-700" },
  unavailable: { label: "Can't work", cls: "bg-rose-100 text-rose-700" },
}

export function StaffPortal({
  name,
  weekStart,
  rotaDays,
  initialShifts,
  initialAvailability,
  initialSwaps,
  initialTimecards,
  initialTasks,
  staffMemberId,
  venueId,
}: Props) {
  const [shifts] = useState<DbRotaShift[]>(initialShifts)
  const [tasks, setTasks] = useState<TaskWithItems[]>(initialTasks)
  const openTaskCount = tasks.filter((t) => t.status !== "Completed").length
  const [availability, setAvailabilityState] = useState<DbAvailability[]>(initialAvailability)
  const [swaps, setSwaps] = useState<DbShiftSwap[]>(initialSwaps)
  const [clockState, setClockState] = useState<"out" | "in">("out")
  const [working, setWorking] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Swap dialog
  const [swapShift, setSwapShift] = useState<DbRotaShift | null>(null)
  const [swapType, setSwapType] = useState<"drop" | "swap">("drop")
  const [swapNote, setSwapNote] = useState("")
  const [swapSaving, setSwapSaving] = useState(false)

  const sortedShifts = useMemo(
    () => [...shifts].sort((a, b) => (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9)),
    [shifts],
  )

  const totalHours = useMemo(
    () => shifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins), 0),
    [shifts],
  )

  const availByDay = useMemo(() => {
    const m = new Map<string, DbAvailability>()
    for (const a of availability) m.set(a.day, a)
    return m
  }, [availability])

  const pendingSwapShiftIds = useMemo(
    () => new Set(swaps.filter((s) => s.status === "pending").map((s) => s.shiftId)),
    [swaps],
  )

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

  function cycleAvailability(day: string) {
    if (staffMemberId == null) return
    const current = (availByDay.get(day)?.status as AvailStatus) ?? "available"
    const next = AVAIL_CYCLE[(AVAIL_CYCLE.indexOf(current) + 1) % AVAIL_CYCLE.length]
    // Optimistic update
    setAvailabilityState((prev) => {
      const others = prev.filter((a) => a.day !== day)
      return [
        ...others,
        {
          id: availByDay.get(day)?.id ?? -Date.now(),
          userId: "",
          venueId,
          staffMemberId,
          day,
          status: next,
          startTime: null,
          endTime: null,
          note: null,
          createdAt: new Date(),
        } as DbAvailability,
      ]
    })
    startTransition(async () => {
      await setAvailability({ venueId, staffMemberId, day, status: next })
    })
  }

  function openSwap(shift: DbRotaShift) {
    setSwapShift(shift)
    setSwapType("drop")
    setSwapNote("")
  }

  async function submitSwap() {
    if (!swapShift) return
    setSwapSaving(true)
    try {
      const created = await requestSwap({ shiftId: swapShift.id, type: swapType, note: swapNote.trim() || null })
      setSwaps((prev) => [created, ...prev])
      setSwapShift(null)
    } finally {
      setSwapSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={`Hi, ${name.split(" ")[0]}`}
        description="Your shifts, availability and timecards."
        actions={<WeekNav weekStart={weekStart} />}
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
            <Button variant="outline" disabled={working || clockState === "out"} onClick={() => handleClock("out")}>
              <LogOut className="size-4" /> Clock out
            </Button>
            <Button disabled={working || clockState === "in"} onClick={() => handleClock("in")}>
              <LogIn className="size-4" /> Clock in
            </Button>
          </div>
        </CardContent>
        {feedback && (
          <div className="border-t border-border px-5 py-2 text-xs font-medium text-muted-foreground">{feedback}</div>
        )}
      </Card>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="tasks">
            My tasks
            {openTaskCount > 0 && (
              <Badge variant="outline" className="ml-1 border-transparent bg-chart-4/20 text-[oklch(0.45_0.11_70)]">
                {openTaskCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="timecards">Timecards</TabsTrigger>
        </TabsList>

        {/* ── Schedule ── */}
        <TabsContent value="schedule" className="mt-4 flex flex-col gap-4">
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
                      <li key={day} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                        <div className="w-10 shrink-0 text-sm font-medium text-muted-foreground">{day}</div>
                        <div className="flex flex-1 flex-col gap-1.5">
                          {dayShifts.length === 0 ? (
                            <span className="text-sm text-muted-foreground/50">Off</span>
                          ) : (
                            dayShifts.map((s) => {
                              const cc = colorClasses(s.color)
                              const pending = pendingSwapShiftIds.has(s.id)
                              return (
                                <div key={s.id} className={cn("rounded-md border px-2.5 py-1.5 text-sm", cc.block)}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{s.role || "Shift"}</span>
                                    <span className="text-xs opacity-80">
                                      {formatHours(shiftHours(s.startTime, s.endTime, s.breakMins))}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs opacity-80">
                                      {timeLabel(s.startTime, s.endTime, s.shiftTime)}
                                    </span>
                                    {pending ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-medium">
                                        <ArrowLeftRight className="size-3" /> Requested
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openSwap(s)}
                                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium underline-offset-2 hover:underline"
                                      >
                                        <ArrowLeftRight className="size-3" /> Swap / drop
                                      </button>
                                    )}
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
        </TabsContent>

        {/* ── My tasks ── */}
        <TabsContent value="tasks" className="mt-4">
          <MyTasksTab tasks={tasks} setTasks={setTasks} />
        </TabsContent>

        {/* ── Availability ── */}
        <TabsContent value="availability" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My availability</CardTitle>
              <p className="text-xs text-muted-foreground">
                Tap a day to cycle: Available → Prefer → Can&apos;t work. Your manager sees this on the rota.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rotaDays.map((day) => {
                  const status = (availByDay.get(day)?.status as AvailStatus) ?? "available"
                  const style = availStyles[status]
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => cycleAvailability(day)}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="text-sm font-medium text-foreground">{day}</span>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", style.cls)}>
                        {style.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timecards ── */}
        <TabsContent value="timecards" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">My timecards</CardTitle>
              <span className="text-xs text-muted-foreground">{weekRangeLabel(weekStart)}</span>
            </CardHeader>
            <CardContent>
              {initialTimecards.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                  <Clock className="size-8 opacity-40" />
                  <p className="text-sm">No timecards recorded this week.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {initialTimecards.map((tc) => {
                    const worked =
                      tc.clockIn && tc.clockOut ? shiftHours(tc.clockIn, tc.clockOut, tc.breakMins) : 0
                    return (
                      <li
                        key={tc.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">{tc.dateISO}</div>
                          <div className="text-xs text-muted-foreground">
                            {tc.clockIn ?? "--"}–{tc.clockOut ?? "--"}
                            {tc.breakMins ? ` · ${tc.breakMins}m break` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm tabular-nums text-foreground">{formatHours(worked)}</span>
                          {tc.status === "approved" ? (
                            <Badge variant="outline" className="border-transparent bg-chart-2/15 text-chart-2">
                              <Check className="size-3" /> Approved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-transparent bg-chart-4/20 text-[oklch(0.45_0.11_70)]">
                              Open
                            </Badge>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Swap / drop dialog */}
      <Dialog open={!!swapShift} onOpenChange={(o) => !o && setSwapShift(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request swap or drop</DialogTitle>
            <DialogDescription>
              {swapShift
                ? `${swapShift.day} · ${timeLabel(swapShift.startTime, swapShift.endTime, swapShift.shiftTime)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={swapType} onValueChange={(v) => v && setSwapType(v as "drop" | "swap")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drop">Drop — give shift to the open pool</SelectItem>
                  <SelectItem value="swap">Swap — ask a colleague to cover</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="swap-note">Note for your manager (optional)</Label>
              <Textarea
                id="swap-note"
                value={swapNote}
                onChange={(e) => setSwapNote(e.target.value)}
                placeholder="e.g. doctor's appointment"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapShift(null)}>
              Cancel
            </Button>
            <Button onClick={submitSwap} disabled={swapSaving}>
              {swapSaving ? "Sending..." : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── My tasks ────────────────────────────────────────────────────────────────

async function uploadTaskImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch("/api/upload-asset-image", { method: "POST", body: fd })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Upload failed")
  }
  const data = await res.json()
  return data.url as string
}

function taskPriorityTone(priority: string) {
  if (priority === "High") return "bg-destructive/12 text-destructive"
  if (priority === "Medium") return "bg-chart-4/20 text-[oklch(0.45_0.11_70)]"
  return "bg-muted text-muted-foreground"
}

function MyTasksTab({
  tasks,
  setTasks,
}: {
  tasks: TaskWithItems[]
  setTasks: Dispatch<SetStateAction<TaskWithItems[]>>
}) {
  const open = tasks.filter((t) => t.status !== "Completed")
  const done = tasks.filter((t) => t.status === "Completed")

  function patch(updated: TaskWithItems) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ListChecks className="size-8 opacity-40" />
          <p className="text-sm">No tasks assigned to you right now.</p>
          <p className="max-w-xs text-xs">
            When your manager assigns you a job — or a recurring task comes due — it&apos;ll appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {open.map((t) => (
        <StaffTaskCard key={t.id} task={t} onChange={patch} />
      ))}
      {done.length > 0 && (
        <>
          <p className="mt-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Completed
          </p>
          {done.map((t) => (
            <StaffTaskCard key={t.id} task={t} onChange={patch} />
          ))}
        </>
      )}
    </div>
  )
}

function StaffTaskCard({
  task,
  onChange,
}: {
  task: TaskWithItems
  onChange: (t: TaskWithItems) => void
}) {
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doneCount = task.items.filter((i) => i.done).length
  const completed = task.status === "Completed"

  function toggleItem(itemId: number, done: boolean) {
    onChange({ ...task, items: task.items.map((i) => (i.id === itemId ? { ...i, done } : i)) })
    startTransition(() => {
      staffToggleTaskItem(itemId, done)
    })
  }

  function setCompleted(photoUrl?: string) {
    onChange({ ...task, status: "Completed", photoUrl: photoUrl ?? task.photoUrl, completedAt: new Date() })
    startTransition(() => {
      staffUpdateTaskStatus({ taskId: task.id, status: "Completed", photoUrl })
    })
  }

  function reopen() {
    onChange({ ...task, status: "Pending", completedAt: null })
    startTransition(() => {
      staffUpdateTaskStatus({ taskId: task.id, status: "Pending" })
    })
  }

  function complete() {
    if (task.requiresPhoto && !task.photoUrl) {
      fileRef.current?.click()
      return
    }
    setCompleted()
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadTaskImage(file)
      setCompleted(url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className={cn("gap-0 p-4", completed && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
              {task.category}
            </Badge>
            <Badge variant="outline" className={cn("border-transparent", taskPriorityTone(task.priority))}>
              {task.priority}
            </Badge>
          </div>
          <p className={cn("mt-2 font-medium text-foreground", completed && "line-through")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {task.dueDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                {task.dueDate}
                {task.dueTime ? ` · ${task.dueTime}` : ""}
              </span>
            )}
            {task.recurrenceParentId != null && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3.5" />
                {task.frequency}
              </span>
            )}
          </div>
        </div>
        {completed ? (
          <Badge variant="outline" className="border-transparent bg-chart-2/15 text-chart-2">
            <Check className="size-3" /> Done
          </Badge>
        ) : null}
      </div>

      {task.notes ? (
        <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
          <StickyNote className="mt-0.5 size-3 shrink-0" /> {task.notes}
        </p>
      ) : null}

      {task.items.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Checklist</span>
            <span>
              {doneCount}/{task.items.length}
            </span>
          </div>
          <Progress value={task.items.length ? (doneCount / task.items.length) * 100 : 0} />
          <ul className="mt-1 flex flex-col gap-1.5">
            {task.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`mytask-${item.id}`}
                  checked={item.done}
                  onCheckedChange={(c) => toggleItem(item.id, c === true)}
                  disabled={completed}
                />
                <label
                  htmlFor={`mytask-${item.id}`}
                  className={cn("text-sm", item.done ? "text-muted-foreground line-through" : "text-foreground")}
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {completed ? (
          <Button size="sm" variant="outline" onClick={reopen} disabled={pending}>
            Reopen
          </Button>
        ) : (
          <Button size="sm" onClick={complete} disabled={pending || uploading}>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : task.requiresPhoto && !task.photoUrl ? (
              <Camera className="size-4" />
            ) : (
              <Check className="size-4" />
            )}
            {task.requiresPhoto && !task.photoUrl ? "Photo & complete" : "Mark complete"}
          </Button>
        )}
      </div>
    </Card>
  )
}
