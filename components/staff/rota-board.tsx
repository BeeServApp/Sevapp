"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Send, Trash2, Clock, Coffee, StickyNote, CopyPlus, AlertTriangle } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveShift, moveShift, deleteShift, publishRota, type ShiftInput } from "@/app/actions/staff"
import { copyRota } from "@/app/actions/scheduling"
import type { DbStaffMember, DbRotaShift, DbAvailability, DbSchedulingSettings } from "@/lib/db/schema"
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
  onShiftsChange: (updater: (prev: DbRotaShift[]) => DbRotaShift[]) => void
}

const OPEN_ROW_ID = 0

interface EditorState {
  shift: DbRotaShift | null
  staffMemberId: number
  day: string
}

export function RotaBoard({ venueId, weekStart, rotaDays, staff, shifts, availability, settings, onShiftsChange }: Props) {
  const router = useRouter()
  const [isPublishing, startPublish] = useTransition()
  const [isCopying, startCopy] = useTransition()
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)

  const overtimeLimit = settings?.overtimeWeeklyHours ?? 0

  // Availability lookup: staffMemberId -> day -> row
  const availByStaffDay = useMemo(() => {
    const map = new Map<string, DbAvailability>()
    for (const a of availability) map.set(`${a.staffMemberId}:${a.day}`, a)
    return map
  }, [availability])

  function handleCopyLastWeek() {
    setPublishMsg(null)
    startCopy(async () => {
      const res = await copyRota(venueId, weekStart)
      if (res.copied === 0) {
        setPublishMsg("No shifts found in the previous week to copy.")
      } else {
        setPublishMsg(`Copied ${res.copied} shift${res.copied > 1 ? "s" : ""} from last week as drafts.`)
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
  })
  const [saving, setSaving] = useState(false)

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
    })
  }

  function openEdit(shift: DbRotaShift) {
    setEditor({ shift, staffMemberId: shift.staffMemberId, day: shift.day })
    setForm({
      role: shift.role ?? "",
      startTime: shift.startTime ?? "09:00",
      endTime: shift.endTime ?? "17:00",
      color: shift.color ?? "green",
      breakMins: String(shift.breakMins ?? 0),
      payRate: shift.payRatePence ? (shift.payRatePence / 100).toFixed(2) : "",
      notes: shift.notes ?? "",
    })
  }

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    try {
      const payload: ShiftInput = {
        id: editor.shift?.id,
        venueId,
        staffMemberId: editor.staffMemberId,
        weekStart,
        day: editor.day,
        role: form.role.trim() || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        color: form.color,
        breakMins: Number.parseInt(form.breakMins, 10) || 0,
        payRatePence: form.payRate ? Math.round(Number.parseFloat(form.payRate) * 100) : 0,
        notes: form.notes.trim() || null,
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
      setEditor(null)
    } finally {
      setSaving(false)
    }
  }

  // ── Drag and drop ────────────────────────────────────────────────────────────
  function onDrop(staffMemberId: number, day: string) {
    const id = dragId
    setDragId(null)
    setDropTarget(null)
    if (id == null) return
    const moving = shifts.find((s) => s.id === id)
    if (!moving || (moving.staffMemberId === staffMemberId && moving.day === day)) return

    // Optimistic update.
    onShiftsChange((prev) => prev.map((s) => (s.id === id ? { ...s, staffMemberId, day } : s)))
    void moveShift(id, staffMemberId, day).then((updated) => {
      onShiftsChange((prev) => prev.map((s) => (s.id === id ? updated : s)))
    })
  }

  function handlePublish() {
    setPublishMsg(null)
    startPublish(async () => {
      const res = await publishRota(venueId, weekStart)
      onShiftsChange((prev) => prev.map((s) => (s.status === "draft" ? { ...s, status: "published" } : s)))
      setPublishMsg(
        res.published === 0
          ? "Everything is already published."
          : `Published ${res.published} shift${res.published > 1 ? "s" : ""}` +
              (res.notified > 0 ? ` · notified ${res.notified} staff` : ""),
      )
    })
  }

  // ── Render a single shift block ──────────────────────────────────────────────
  function ShiftBlock({ shift }: { shift: DbRotaShift }) {
    const cc = colorClasses(shift.color)
    const hrs = shiftHours(shift.startTime, shift.endTime, shift.breakMins)
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
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-semibold">{shift.role || "Shift"}</span>
          {shift.status === "draft" && (
            <span className="shrink-0 rounded bg-foreground/10 px-1 text-[10px] font-medium uppercase tracking-wide">
              Draft
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1 font-medium opacity-80">
          {timeLabel(shift.startTime, shift.endTime, shift.shiftTime)}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] opacity-70">
          {hrs > 0 && <span>{formatHours(hrs)}</span>}
          {shift.breakMins ? (
            <span className="inline-flex items-center gap-0.5">
              <Coffee className="size-2.5" />
              {shift.breakMins}m
            </span>
          ) : null}
          {shift.notes ? <StickyNote className="size-2.5" /> : null}
        </div>
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

  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <WeekNav weekStart={weekStart} />
          <Button variant="outline" size="sm" onClick={handleCopyLastWeek} disabled={isCopying}>
            <CopyPlus className="size-4" />
            {isCopying ? "Copying..." : "Copy last week"}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{formatHours(weekHours)}</div>
            <div>{formatMoney(weekCost)} labour</div>
          </div>
          <Button onClick={handlePublish} disabled={isPublishing || !hasDraft}>
            <Send className="size-4" />
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {publishMsg && (
        <div className="border-b border-border bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800">
          {publishMsg}
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
          <div className="grid gap-4">
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
    </Card>
  )
}
