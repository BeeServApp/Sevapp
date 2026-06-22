"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Send,
  Trash2,
  Clock,
  Coffee,
  StickyNote,
  CopyPlus,
  AlertTriangle,
  Repeat,
  Wand2,
  LayoutTemplate,
  MoreHorizontal,
  Eraser,
  UserMinus,
  Undo2,
  ListChecks,
  CalendarPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveShift, moveShift, deleteShift, publishRota, type ShiftInput } from "@/app/actions/staff"
import { copyRota } from "@/app/actions/scheduling"
import {
  createShiftPattern,
  deleteShiftPattern,
  saveRotaTemplate,
  applyRotaTemplate,
  deleteRotaTemplate,
  autoFillOpenShifts,
  clearWeek,
  unassignAllShifts,
  unpublishRota,
  bulkAddShifts,
  addShiftTask,
  deleteShiftTask,
  toggleShiftTask,
} from "@/app/actions/shift-planning"
import type {
  DbStaffMember,
  DbRotaShift,
  DbAvailability,
  DbSchedulingSettings,
  DbShiftPattern,
  DbRotaTemplate,
  DbShiftTask,
} from "@/lib/db/schema"
import {
  SHIFT_COLORS,
  colorClasses,
  shiftHours,
  formatHours,
  formatMoney,
  timeLabel,
} from "@/lib/rota"
import { WeekNav } from "@/components/staff/week-nav"
import { cn } from "@/lib/utils"

interface Props {
  venueId: number
  weekStart: string
  rotaDays: string[]
  staff: DbStaffMember[]
  shifts: DbRotaShift[]
  availability: DbAvailability[]
  settings: DbSchedulingSettings
  patterns: DbShiftPattern[]
  templates: (DbRotaTemplate & { shiftCount: number })[]
  shiftTasks: DbShiftTask[]
  conflicts: Record<number, string>
  onShiftsChange: (updater: (prev: DbRotaShift[]) => DbRotaShift[]) => void
}

const OPEN_ROW_ID = 0

const REPEAT_OPTIONS = [
  { value: "1", label: "Every week" },
  { value: "2", label: "Every 2 weeks" },
  { value: "3", label: "Every 3 weeks" },
  { value: "4", label: "Every 4 weeks" },
]

interface EditorState {
  shift: DbRotaShift | null
  staffMemberId: number
  day: string
}

export function RotaBoard({
  venueId,
  weekStart,
  rotaDays,
  staff,
  shifts,
  availability,
  settings,
  patterns,
  templates,
  shiftTasks,
  conflicts,
  onShiftsChange,
}: Props) {
  const router = useRouter()
  const [isPublishing, startPublish] = useTransition()
  const [isCopying, startCopy] = useTransition()
  const [isActing, startAct] = useTransition()
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const overtimeLimit = settings?.overtimeWeeklyHours ?? 0

  // Local, optimistic copy of shift tasks so checkboxes update instantly.
  const [tasks, setTasks] = useState<DbShiftTask[]>(shiftTasks)
  useEffect(() => setTasks(shiftTasks), [shiftTasks])

  const tasksByShift = useMemo(() => {
    const map = new Map<number, DbShiftTask[]>()
    for (const t of tasks) {
      const list = map.get(t.shiftId) ?? []
      list.push(t)
      map.set(t.shiftId, list)
    }
    return map
  }, [tasks])

  // Availability lookup: staffMemberId -> day -> row
  const availByStaffDay = useMemo(() => {
    const map = new Map<string, DbAvailability>()
    for (const a of availability) map.set(`${a.staffMemberId}:${a.day}`, a)
    return map
  }, [availability])

  const openShiftCount = useMemo(() => shifts.filter((s) => s.staffMemberId === OPEN_ROW_ID).length, [shifts])
  const hasPublished = useMemo(() => shifts.some((s) => s.status === "published"), [shifts])

  function handleCopyLastWeek() {
    setStatusMsg(null)
    startCopy(async () => {
      const res = await copyRota(venueId, weekStart)
      if (res.copied === 0) {
        setStatusMsg("No shifts found in the previous week to copy.")
      } else {
        setStatusMsg(`Copied ${res.copied} shift${res.copied > 1 ? "s" : ""} from last week as drafts.`)
        router.refresh()
      }
    })
  }

  // ── Editor dialog ───────────────────────────────────────────────────────────
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [form, setForm] = useState({
    role: "",
    startTime: "09:00",
    endTime: "17:00",
    color: "green",
    breakMins: "0",
    payRate: "",
    notes: "",
    recurring: false,
    repeatWeeks: "1",
  })
  const [saving, setSaving] = useState(false)
  const [newTaskLabel, setNewTaskLabel] = useState("")

  const hasDraft = useMemo(() => shifts.some((s) => s.status === "draft"), [shifts])

  function shiftsFor(staffMemberId: number, day: string) {
    return shifts.filter((s) => s.staffMemberId === staffMemberId && s.day === day)
  }

  // ── Per-row + per-day totals ─────────────────────────────────────────────────
  function rowHours(staffMemberId: number) {
    return shifts
      .filter((s) => s.staffMemberId === staffMemberId)
      .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins), 0)
  }
  function rowCost(staffMemberId: number) {
    return shifts
      .filter((s) => s.staffMemberId === staffMemberId)
      .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins) * (s.payRatePence ?? 0), 0)
  }
  function dayHours(day: string) {
    return shifts
      .filter((s) => s.day === day)
      .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins), 0)
  }
  function dayCost(day: string) {
    return shifts
      .filter((s) => s.day === day)
      .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins) * (s.payRatePence ?? 0), 0)
  }

  const weekHours = rotaDays.reduce((sum, d) => sum + dayHours(d), 0)
  const weekCost = rotaDays.reduce((sum, d) => sum + dayCost(d), 0)

  // ── Open editor ────────────────────────────────────────────────────────────
  function openNew(staffMemberId: number, day: string) {
    setEditor({ shift: null, staffMemberId, day })
    setNewTaskLabel("")
    const member = staff.find((s) => s.id === staffMemberId)
    const defaultRate = member?.defaultPayRatePence ? (member.defaultPayRatePence / 100).toFixed(2) : ""
    setForm({
      role: member?.role && member.role !== "Staff" ? member.role : "",
      startTime: "09:00",
      endTime: "17:00",
      color: "green",
      breakMins: "0",
      payRate: defaultRate,
      notes: "",
      recurring: false,
      repeatWeeks: "1",
    })
  }

  function openEdit(shift: DbRotaShift) {
    setEditor({ shift, staffMemberId: shift.staffMemberId, day: shift.day })
    setNewTaskLabel("")
    setForm({
      role: shift.role ?? "",
      startTime: shift.startTime ?? "09:00",
      endTime: shift.endTime ?? "17:00",
      color: shift.color ?? "green",
      breakMins: String(shift.breakMins ?? 0),
      payRate: shift.payRatePence ? (shift.payRatePence / 100).toFixed(2) : "",
      notes: shift.notes ?? "",
      recurring: false,
      repeatWeeks: "1",
    })
  }

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    try {
      const role = form.role.trim() || null
      const startTime = form.startTime || null
      const endTime = form.endTime || null
      const breakMins = Number.parseInt(form.breakMins, 10) || 0
      const payRatePence = form.payRate ? Math.round(Number.parseFloat(form.payRate) * 100) : 0
      const notes = form.notes.trim() || null

      // New + recurring → create a pattern, which generates this week's occurrence.
      if (!editor.shift && form.recurring) {
        await createShiftPattern({
          venueId,
          staffMemberId: editor.staffMemberId,
          day: editor.day,
          role,
          startTime,
          endTime,
          color: form.color,
          breakMins,
          notes,
          payRatePence,
          repeatWeeks: Number.parseInt(form.repeatWeeks, 10) || 1,
          anchorWeek: weekStart,
        })
        setEditor(null)
        router.refresh()
        return
      }

      const payload: ShiftInput = {
        id: editor.shift?.id,
        venueId,
        staffMemberId: editor.staffMemberId,
        weekStart,
        day: editor.day,
        role,
        startTime,
        endTime,
        color: form.color,
        breakMins,
        payRatePence,
        notes,
      }
      const saved = await saveShift(payload)
      onShiftsChange((prev) => {
        const without = prev.filter((s) => s.id !== saved.id)
        return [...without, saved]
      })
      setEditor(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editor?.shift) return
    setSaving(true)
    try {
      const id = editor.shift.id
      await deleteShift(id)
      onShiftsChange((prev) => prev.filter((s) => s.id !== id))
      setTasks((prev) => prev.filter((t) => t.shiftId !== id))
      setEditor(null)
    } finally {
      setSaving(false)
    }
  }

  // ── Shift tasks (within the editor) ──────────────────────────────────────────
  async function handleAddTask() {
    if (!editor?.shift) return
    const label = newTaskLabel.trim()
    if (!label) return
    setNewTaskLabel("")
    const created = await addShiftTask(editor.shift.id, label)
    setTasks((prev) => [...prev, created])
  }

  async function handleToggleTask(t: DbShiftTask) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
    await toggleShiftTask(t.id, !t.done)
  }

  async function handleRemoveTask(id: number) {
    setTasks((prev) => prev.filter((x) => x.id !== id))
    await deleteShiftTask(id)
  }

  // ── Drag and drop ────────────────────────────────────────────────────────────
  function onDrop(staffMemberId: number, day: string) {
    const id = dragId
    setDragId(null)
    setDropTarget(null)
    if (id == null) return
    const moving = shifts.find((s) => s.id === id)
    if (!moving || (moving.staffMemberId === staffMemberId && moving.day === day)) return

    onShiftsChange((prev) => prev.map((s) => (s.id === id ? { ...s, staffMemberId, day } : s)))
    void moveShift(id, staffMemberId, day).then((updated) => {
      onShiftsChange((prev) => prev.map((s) => (s.id === id ? updated : s)))
    })
  }

  function handlePublish() {
    setStatusMsg(null)
    startPublish(async () => {
      const res = await publishRota(venueId, weekStart)
      onShiftsChange((prev) => prev.map((s) => (s.status === "draft" ? { ...s, status: "published" } : s)))
      setStatusMsg(
        res.published === 0
          ? "Everything is already published."
          : `Published ${res.published} shift${res.published > 1 ? "s" : ""}` +
              (res.notified > 0 ? ` · notified ${res.notified} staff` : ""),
      )
    })
  }

  // ── Bulk + reverse actions ────────────────────────────────────────────────────
  function handleAutoFill() {
    setStatusMsg(null)
    startAct(async () => {
      const res = await autoFillOpenShifts(venueId, weekStart)
      setStatusMsg(
        res.assigned === 0
          ? "No open shifts could be auto-assigned (check availability and limits)."
          : `Auto-assigned ${res.assigned} open shift${res.assigned > 1 ? "s" : ""}` +
              (res.remaining > 0 ? ` · ${res.remaining} still open` : ""),
      )
      router.refresh()
    })
  }

  function handleClearWeek() {
    if (!window.confirm("Delete every shift in this week? This cannot be undone.")) return
    setStatusMsg(null)
    startAct(async () => {
      const res = await clearWeek(venueId, weekStart)
      setStatusMsg(`Cleared ${res.cleared} shift${res.cleared === 1 ? "" : "s"}.`)
      onShiftsChange(() => [])
      router.refresh()
    })
  }

  function handleUnassignAll() {
    if (!window.confirm("Move every assigned shift back to the open pool?")) return
    setStatusMsg(null)
    startAct(async () => {
      const res = await unassignAllShifts(venueId, weekStart)
      setStatusMsg(`Moved ${res.unassigned} shift${res.unassigned === 1 ? "" : "s"} to the open pool.`)
      onShiftsChange((prev) => prev.map((s) => ({ ...s, staffMemberId: OPEN_ROW_ID })))
      router.refresh()
    })
  }

  function handleUnpublish() {
    setStatusMsg(null)
    startAct(async () => {
      const res = await unpublishRota(venueId, weekStart)
      setStatusMsg(
        res.unpublished === 0
          ? "Nothing is published yet."
          : `Reverted ${res.unpublished} shift${res.unpublished === 1 ? "" : "s"} to draft.`,
      )
      onShiftsChange((prev) => prev.map((s) => ({ ...s, status: "draft" })))
      router.refresh()
    })
  }

  function handleApplyTemplate(id: number) {
    setStatusMsg(null)
    startAct(async () => {
      const res = await applyRotaTemplate(id, venueId, weekStart)
      setStatusMsg(`Applied template · added ${res.applied} draft shift${res.applied === 1 ? "" : "s"}.`)
      router.refresh()
    })
  }

  function handleDeleteTemplate(id: number) {
    startAct(async () => {
      await deleteRotaTemplate(id)
      router.refresh()
    })
  }

  function handleDeletePattern(id: number) {
    startAct(async () => {
      await deleteShiftPattern(id)
      setStatusMsg("Recurring pattern removed.")
      router.refresh()
    })
  }

  // ── Save-as-template dialog ───────────────────────────────────────────────────
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  function handleSaveTemplate() {
    const name = templateName.trim()
    if (!name) return
    startAct(async () => {
      const res = await saveRotaTemplate(venueId, weekStart, name)
      setTemplateOpen(false)
      setTemplateName("")
      setStatusMsg(
        res.saved === 0
          ? "This week has no shifts to save."
          : `Saved "${name}" with ${res.saved} shift${res.saved === 1 ? "" : "s"}.`,
      )
      router.refresh()
    })
  }

  // ── Bulk-add dialog ───────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState({
    staffMemberId: "0",
    days: [] as string[],
    role: "",
    startTime: "09:00",
    endTime: "17:00",
    breakMins: "0",
    payRate: "",
    color: "green",
  })
  function openBulk() {
    setBulk({
      staffMemberId: "0",
      days: [],
      role: "",
      startTime: "09:00",
      endTime: "17:00",
      breakMins: "0",
      payRate: "",
      color: "green",
    })
    setBulkOpen(true)
  }
  function toggleBulkDay(day: string) {
    setBulk((b) => ({
      ...b,
      days: b.days.includes(day) ? b.days.filter((d) => d !== day) : [...b.days, day],
    }))
  }
  function handleBulkAdd() {
    if (bulk.days.length === 0) return
    startAct(async () => {
      await bulkAddShifts({
        venueId,
        weekStart,
        staffMemberId: Number.parseInt(bulk.staffMemberId, 10) || 0,
        days: bulk.days,
        role: bulk.role.trim() || null,
        startTime: bulk.startTime || null,
        endTime: bulk.endTime || null,
        breakMins: Number.parseInt(bulk.breakMins, 10) || 0,
        payRatePence: bulk.payRate ? Math.round(Number.parseFloat(bulk.payRate) * 100) : 0,
        color: bulk.color,
      })
      setBulkOpen(false)
      setStatusMsg(`Added ${bulk.days.length} shift${bulk.days.length === 1 ? "" : "s"}.`)
      router.refresh()
    })
  }

  // ── Render a single shift block ──────────────────────────────────────────────
  function ShiftBlock({ shift }: { shift: DbRotaShift }) {
    const cc = colorClasses(shift.color)
    const hrs = shiftHours(shift.startTime, shift.endTime, shift.breakMins)
    const conflict = conflicts[shift.id]
    const shiftTaskList = tasksByShift.get(shift.id) ?? []
    const doneCount = shiftTaskList.filter((t) => t.done).length
    return (
      <button
        type="button"
        draggable
        onDragStart={() => setDragId(shift.id)}
        onDragEnd={() => {
          setDragId(null)
          setDropTarget(null)
        }}
        onClick={() => openEdit(shift)}
        className={cn(
          "group/block relative w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
          cc.block,
          dragId === shift.id && "opacity-40",
          conflict && "ring-1 ring-rose-400",
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-semibold">{shift.role || "Shift"}</span>
          <span className="flex shrink-0 items-center gap-1">
            {shift.patternId ? <Repeat className="size-3 opacity-70" aria-label="Recurring" /> : null}
            {shift.status === "draft" && (
              <span className="rounded bg-foreground/10 px-1 text-[10px] font-medium uppercase tracking-wide">
                Draft
              </span>
            )}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 font-medium opacity-80">
          {timeLabel(shift.startTime, shift.endTime, shift.shiftTime)}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] opacity-70">
          {hrs > 0 && <span>{formatHours(hrs)}</span>}
          {shift.breakMins ? (
            <span className="inline-flex items-center gap-0.5">
              <Coffee className="size-2.5" />
              {shift.breakMins}m
            </span>
          ) : null}
          {shift.notes ? <StickyNote className="size-2.5" /> : null}
          {shiftTaskList.length > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <ListChecks className="size-2.5" />
              {doneCount}/{shiftTaskList.length}
            </span>
          ) : null}
        </div>
        {conflict ? (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-rose-600" title={conflict}>
            <AlertTriangle className="size-2.5 shrink-0" />
            <span className="truncate">{conflict}</span>
          </div>
        ) : null}
      </button>
    )
  }

  // ── Render a droppable cell ──────────────────────────────────────────────────
  function Cell({ staffMemberId, day }: { staffMemberId: number; day: string }) {
    const cellShifts = shiftsFor(staffMemberId, day)
    const key = `${staffMemberId}:${day}`
    const avail = staffMemberId > 0 ? availByStaffDay.get(key) : undefined
    const unavailable = avail?.status === "unavailable"
    const preferred = avail?.status === "preferred"
    return (
      <td
        className={cn(
          "align-top border-l border-border p-1.5",
          unavailable && "bg-rose-50/60",
          preferred && "bg-emerald-50/40",
          dropTarget === key && "bg-accent/60 ring-1 ring-inset ring-primary/40",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          if (dropTarget !== key) setDropTarget(key)
        }}
        onDragLeave={() => setDropTarget((t) => (t === key ? null : t))}
        onDrop={() => onDrop(staffMemberId, day)}
      >
        {avail ? (
          <div
            className={cn(
              "mb-1 flex items-center gap-1 text-[10px] font-medium",
              unavailable ? "text-rose-600" : "text-emerald-600",
            )}
            title={avail.note ?? undefined}
          >
            <span className={cn("size-1.5 rounded-full", unavailable ? "bg-rose-500" : "bg-emerald-500")} />
            {unavailable
              ? "Unavailable"
              : `Prefers${avail.startTime ? ` ${avail.startTime}–${avail.endTime}` : ""}`}
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          {cellShifts.map((s) => (
            <ShiftBlock key={s.id} shift={s} />
          ))}
          <button
            type="button"
            onClick={() => openNew(staffMemberId, day)}
            className="flex items-center justify-center rounded-md border border-dashed border-transparent py-1 text-muted-foreground/0 transition-colors hover:border-border hover:text-muted-foreground"
            aria-label="Add shift"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </td>
    )
  }

  const editorTasks = editor?.shift ? tasksByShift.get(editor.shift.id) ?? [] : []

  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <WeekNav weekStart={weekStart} />
          <Button variant="outline" size="sm" onClick={handleCopyLastWeek} disabled={isCopying}>
            <CopyPlus className="size-4" />
            {isCopying ? "Copying..." : "Copy last week"}
          </Button>
          <Button variant="outline" size="sm" onClick={openBulk}>
            <CalendarPlus className="size-4" />
            Bulk add
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoFill}
            disabled={isActing || openShiftCount === 0}
            title={openShiftCount === 0 ? "No open shifts to fill" : undefined}
          >
            <Wand2 className="size-4" />
            {isActing ? "Working..." : `Auto-fill${openShiftCount > 0 ? ` (${openShiftCount})` : ""}`}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-1 text-right text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{formatHours(weekHours)}</div>
            <div>{formatMoney(weekCost)} labour</div>
          </div>

          {/* Templates */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <LayoutTemplate className="size-4" />
                  Templates
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                <LayoutTemplate className="size-4" /> Save this week as template…
              </DropdownMenuItem>
              {templates.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Apply a template</DropdownMenuLabel>
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-1 px-1">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(t.id)}
                        className="flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-1 text-xs text-muted-foreground">· {t.shiftCount} shifts</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label={`Delete template ${t.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {patterns.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Recurring patterns</DropdownMenuLabel>
                  {patterns.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-1 px-1">
                      <span className="flex-1 px-2 py-1.5 text-sm">
                        <Repeat className="mr-1 inline size-3 opacity-70" />
                        {p.day} {p.startTime}–{p.endTime}
                        {p.repeatWeeks > 1 ? (
                          <span className="ml-1 text-xs text-muted-foreground">/ {p.repeatWeeks}w</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePattern(p.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label="Remove recurring pattern"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" aria-label="More rota actions">
                  <MoreHorizontal className="size-4" />
                  More
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Bulk actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleUnassignAll} disabled={isActing}>
                <UserMinus className="size-4" /> Move all to open pool
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleUnpublish} disabled={isActing || !hasPublished}>
                <Undo2 className="size-4" /> Revert to draft
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleClearWeek}
                disabled={isActing}
                className="text-destructive focus:text-destructive"
              >
                <Eraser className="size-4" /> Clear week
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={handlePublish} disabled={isPublishing || !hasDraft}>
            <Send className="size-4" />
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div className="border-b border-border bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800">
          {statusMsg}
        </div>
      )}

      {staff.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          Add staff members to build the rota.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 w-48 bg-muted/40 px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Team member
                </th>
                {rotaDays.map((d) => (
                  <th key={d} className="min-w-[8.5rem] border-l border-border px-3 py-2.5 text-left font-medium text-muted-foreground">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Open shifts row */}
              <tr className="border-b border-border bg-muted/20">
                <td className="sticky left-0 z-10 bg-muted/20 px-4 py-2">
                  <div className="font-medium text-foreground">Open shifts</div>
                  <div className="text-xs text-muted-foreground">{formatHours(rowHours(OPEN_ROW_ID))}</div>
                </td>
                {rotaDays.map((day) => (
                  <Cell key={day} staffMemberId={OPEN_ROW_ID} day={day} />
                ))}
              </tr>

              {/* Staff rows */}
              {staff.map((s) => {
                const hrs = rowHours(s.id)
                const overtime = overtimeLimit > 0 && hrs > overtimeLimit
                return (
                <tr key={s.id} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2">
                    <div className="font-medium text-foreground">{s.name}</div>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        overtime ? "font-medium text-amber-600" : "text-muted-foreground",
                      )}
                    >
                      {overtime && <AlertTriangle className="size-3" />}
                      {formatHours(hrs)}
                      {rowCost(s.id) > 0 ? ` · ${formatMoney(rowCost(s.id))}` : ""}
                    </div>
                    {overtime && (
                      <div className="text-[10px] text-amber-600">
                        Over {overtimeLimit}h limit
                      </div>
                    )}
                    {s.role ? (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {s.role}
                      </Badge>
                    ) : null}
                  </td>
                  {rotaDays.map((day) => (
                    <Cell key={day} staffMemberId={s.id} day={day} />
                  ))}
                </tr>
                )
              })}

              {/* Totals row */}
              <tr className="bg-muted/40 text-xs">
                <td className="sticky left-0 z-10 bg-muted/40 px-4 py-2.5 font-medium text-foreground">
                  {formatHours(weekHours)} · {formatMoney(weekCost)}
                </td>
                {rotaDays.map((day) => (
                  <td key={day} className="border-l border-border px-3 py-2.5">
                    <div className="font-medium text-foreground">{formatHours(dayHours(day))}</div>
                    <div className="text-muted-foreground">{formatMoney(dayCost(day))}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Shift editor dialog */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editor?.shift ? "Edit shift" : "Add shift"}</DialogTitle>
            <DialogDescription>
              {editor?.staffMemberId === OPEN_ROW_ID
                ? "Open shift"
                : staff.find((s) => s.id === editor?.staffMemberId)?.name}{" "}
              · {editor?.day}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
            <div className="grid gap-2">
              <Label htmlFor="sh-role">Role</Label>
              <Input
                id="sh-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Bar, Cashier, Manager"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sh-start" className="flex items-center gap-1">
                  <Clock className="size-3.5" /> Start
                </Label>
                <Input
                  id="sh-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sh-end" className="flex items-center gap-1">
                  <Clock className="size-3.5" /> End
                </Label>
                <Input
                  id="sh-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sh-break">Unpaid break (mins)</Label>
                <Input
                  id="sh-break"
                  type="number"
                  min="0"
                  value={form.breakMins}
                  onChange={(e) => setForm((f) => ({ ...f, breakMins: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sh-pay">Pay rate (£/hr)</Label>
                <Input
                  id="sh-pay"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.payRate}
                  onChange={(e) => setForm((f) => ({ ...f, payRate: e.target.value }))}
                  placeholder="e.g. 11.50"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {SHIFT_COLORS.map((c) => {
                  const cc = colorClasses(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full border-2 transition-transform",
                        form.color === c ? "border-foreground scale-110" : "border-transparent",
                      )}
                      aria-label={cc.label}
                    >
                      <span className={cn("size-5 rounded-full", cc.dot)} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sh-notes">Note for staff</Label>
              <Textarea
                id="sh-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional note shown to the assigned staff member"
                rows={2}
              />
            </div>

            {/* Recurring (new shifts only) */}
            {!editor?.shift && (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Repeat className="size-4 text-muted-foreground" />
                    <div>
                      <Label htmlFor="sh-recurring" className="cursor-pointer">
                        Repeat automatically
                      </Label>
                      <p className="text-xs text-muted-foreground">Auto-adds this shift to future weeks as a draft.</p>
                    </div>
                  </div>
                  <Switch
                    id="sh-recurring"
                    checked={form.recurring}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, recurring: v }))}
                  />
                </div>
                {form.recurring && (
                  <div className="mt-3">
                    <Select value={form.repeatWeeks} onValueChange={(v) => setForm((f) => ({ ...f, repeatWeeks: v ?? "1" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPEAT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Shift tasks (existing shifts only) */}
            {editor?.shift && (
              <div className="grid gap-2">
                <Label className="flex items-center gap-1">
                  <ListChecks className="size-3.5" /> Shift tasks
                </Label>
                <p className="text-xs text-muted-foreground">
                  To-dos shown to the assigned staff member for this shift.
                </p>
                <div className="grid gap-1.5">
                  {editorTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                      <Checkbox checked={t.done} onCheckedChange={() => handleToggleTask(t)} aria-label={t.label} />
                      <span className={cn("flex-1 text-sm", t.done && "text-muted-foreground line-through")}>
                        {t.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(t.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        aria-label="Remove task"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTaskLabel}
                    onChange={(e) => setNewTaskLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void handleAddTask()
                      }
                    }}
                    placeholder="Add a task…"
                  />
                  <Button type="button" variant="outline" onClick={handleAddTask} disabled={!newTaskLabel.trim()}>
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            {editor?.shift ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={saving}>
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditor(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save shift"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save-as-template dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save week as template</DialogTitle>
            <DialogDescription>Reuse this week&apos;s shifts in any future week.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="tmpl-name">Template name</Label>
            <Input
              id="tmpl-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Standard week, Summer rota"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSaveTemplate()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isActing || !templateName.trim()}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk-add dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk add shifts</DialogTitle>
            <DialogDescription>Add the same shift across several days at once.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Assign to</Label>
              <Select
                value={bulk.staffMemberId}
                onValueChange={(v) => setBulk((b) => ({ ...b, staffMemberId: v ?? "open" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Open shift (unassigned)</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {rotaDays.map((d) => {
                  const active = bulk.days.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleBulkDay(d)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bk-start">Start</Label>
                <Input
                  id="bk-start"
                  type="time"
                  value={bulk.startTime}
                  onChange={(e) => setBulk((b) => ({ ...b, startTime: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bk-end">End</Label>
                <Input
                  id="bk-end"
                  type="time"
                  value={bulk.endTime}
                  onChange={(e) => setBulk((b) => ({ ...b, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bk-role">Role</Label>
                <Input
                  id="bk-role"
                  value={bulk.role}
                  onChange={(e) => setBulk((b) => ({ ...b, role: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bk-break">Break (mins)</Label>
                <Input
                  id="bk-break"
                  type="number"
                  min="0"
                  value={bulk.breakMins}
                  onChange={(e) => setBulk((b) => ({ ...b, breakMins: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAdd} disabled={isActing || bulk.days.length === 0}>
              Add {bulk.days.length > 0 ? `${bulk.days.length} ` : ""}shift{bulk.days.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
