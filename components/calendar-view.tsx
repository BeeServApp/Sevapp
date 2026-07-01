"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Link2,
  ListChecks,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type CalendarLinkType,
  type LinkableItems,
} from "@/app/actions/calendar"
import type { DbCalendarEvent } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

/* ------------------------------- Metadata --------------------------------- */

const TYPE_META: Record<string, { label: string; defaultColor: ColorKey }> = {
  event: { label: "Event", defaultColor: "blue" },
  meeting: { label: "Meeting", defaultColor: "amber" },
  task: { label: "Task", defaultColor: "gold" },
  booking: { label: "Booking", defaultColor: "amber" },
  maintenance: { label: "Maintenance", defaultColor: "red" },
  reminder: { label: "Reminder", defaultColor: "slate" },
}
const TYPE_ORDER = ["event", "meeting", "task", "booking", "maintenance", "reminder"] as const

type ColorKey = "blue" | "amber" | "gold" | "red" | "slate"
const COLOR_DOT: Record<ColorKey, string> = {
  blue: "bg-chart-2",
  amber: "bg-chart-4",
  gold: "bg-chart-1",
  red: "bg-destructive",
  slate: "bg-muted-foreground",
}
const COLOR_OPTIONS: { value: ColorKey; label: string }[] = [
  { value: "blue", label: "Blue" },
  { value: "amber", label: "Amber" },
  { value: "gold", label: "Gold" },
  { value: "red", label: "Red" },
  { value: "slate", label: "Slate" },
]

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/* ------------------------------ Date helpers ------------------------------ */

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
function startOfMonthGrid(viewDate: Date) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const dow = (first.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(first)
  start.setDate(first.getDate() - dow)
  return start
}
function prettyDate(iso: string) {
  return parseISO(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/* ------------------------------ Normalised item --------------------------- */

interface CalItem {
  key: string
  kind: "calendar" | "taskCheck" | "correctiveAction" | "meeting" | "maintenance"
  refId: number
  title: string
  date: string
  time: string | null
  allDay: boolean
  type: string
  color: ColorKey
  status: string
  description: string | null
  location: string | null
  linkType: string | null
  linkId: number | null
  href: string | null
  source: DbCalendarEvent | null
  venueId: number
  assignedToMe?: boolean
}

interface WorkspaceVenue {
  id: number
  name: string
}

interface DatedCheck {
  id: number
  title: string
  dueDate: string
  dueTime: string | null
  status: string
  priority: string
  venueId: number
}
interface DatedAction {
  id: number
  title: string
  dueDate: string
  status: string
  priority: string
  venueId: number
}
interface DatedMeeting {
  id: number
  title: string
  scheduledDate: string
  status: string
  venueId: number
  assignedToMe?: boolean
}
interface DatedMaintenance {
  id: number
  title: string
  scheduledDate: string
  status: string
  priority: string
  assetId: number | null
  venueId: number
}

export function CalendarView({
  venueId,
  venues,
  initialEvents,
  datedChecks,
  datedActions,
  datedMeetings,
  datedMaintenance,
  linkable,
}: {
  venueId: number
  venues: WorkspaceVenue[]
  initialEvents: DbCalendarEvent[]
  datedChecks: DatedCheck[]
  datedActions: DatedAction[]
  datedMeetings: DatedMeeting[]
  datedMaintenance: DatedMaintenance[]
  linkable: LinkableItems
}) {
  const venueNameById = useMemo(
    () => new Map(venues.map((v) => [v.id, v.name] as const)),
    [venues],
  )
  const multiVenue = venues.length > 1
  // Which venues are currently shown. Defaults to all accessible venues.
  const [activeVenues, setActiveVenues] = useState<Set<number>>(
    () => new Set(venues.map((v) => v.id)),
  )
  const today = toISO(new Date())
  const [viewDate, setViewDate] = useState(() => new Date())
  const [mode, setMode] = useState<"month" | "agenda">("month")
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(TYPE_ORDER))
  const [selectedDate, setSelectedDate] = useState<string | null>(today)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DbCalendarEvent | null>(null)
  const [dialogDate, setDialogDate] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DbCalendarEvent | null>(null)

  // Build the full normalised list once.
  const items: CalItem[] = useMemo(() => {
    const out: CalItem[] = []
    for (const e of initialEvents) {
      out.push({
        key: `cal-${e.id}`,
        kind: "calendar",
        refId: e.id,
        title: e.title,
        date: e.date,
        time: e.startTime,
        allDay: e.allDay,
        type: e.type,
        color: (e.color as ColorKey) ?? "blue",
        status: e.status,
        description: e.description,
        location: e.location,
        linkType: e.linkType,
        linkId: e.linkId,
        href: e.linkType === "taskCheck" || e.linkType === "correctiveAction"
          ? "/tasks"
          : e.linkType === "event" || e.linkType === "task"
            ? "/operations"
            : null,
        source: e,
        venueId: e.venueId,
      })
    }
    for (const c of datedChecks) {
      out.push({
        key: `tc-${c.id}`,
        kind: "taskCheck",
        refId: c.id,
        title: c.title,
        date: c.dueDate,
        time: c.dueTime,
        allDay: !c.dueTime,
        type: "task",
        color: "gold",
        status: c.status,
        description: null,
        location: null,
        linkType: "taskCheck",
        linkId: c.id,
        href: "/tasks",
        source: null,
        venueId: c.venueId,
      })
    }
    for (const a of datedActions) {
      out.push({
        key: `ca-${a.id}`,
        kind: "correctiveAction",
        refId: a.id,
        title: a.title,
        date: a.dueDate,
        time: null,
        allDay: true,
        type: "task",
        color: "red",
        status: a.status,
        description: null,
        location: null,
        linkType: "correctiveAction",
        linkId: a.id,
        href: "/tasks",
        source: null,
        venueId: a.venueId,
      })
    }
    for (const m of datedMeetings) {
      out.push({
        key: `mtg-${m.id}`,
        kind: "meeting",
        refId: m.id,
        title: m.title,
        date: m.scheduledDate,
        time: null,
        allDay: true,
        type: "meeting",
        color: "amber",
        status: m.status,
        description: null,
        location: null,
        linkType: "meeting",
        linkId: m.id,
        href: "/tasks",
        source: null,
        venueId: m.venueId,
        assignedToMe: m.assignedToMe,
      })
    }
    for (const m of datedMaintenance) {
      out.push({
        key: `mnt-${m.id}`,
        kind: "maintenance",
        refId: m.id,
        title: m.title,
        date: m.scheduledDate,
        time: null,
        allDay: true,
        type: "maintenance",
        color: "red",
        status: m.status,
        description: null,
        location: null,
        linkType: "maintenance",
        linkId: m.id,
        href: "/assets",
        source: null,
        venueId: m.venueId,
      })
    }
    return out
  }, [initialEvents, datedChecks, datedActions, datedMeetings, datedMaintenance])

  const visibleItems = useMemo(
    () => items.filter((i) => activeTypes.has(i.type) && activeVenues.has(i.venueId)),
    [items, activeTypes, activeVenues],
  )

  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>()
    for (const i of visibleItems) {
      const arr = map.get(i.date) ?? []
      arr.push(i)
      map.set(i.date, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return (a.time ?? "").localeCompare(b.time ?? "")
      })
    }
    return map
  }, [visibleItems])

  const gridDays = useMemo(() => {
    const start = startOfMonthGrid(viewDate)
    return Array.from({ length: 42 }, (_, idx) => {
      const d = new Date(start)
      d.setDate(start.getDate() + idx)
      return d
    })
  }, [viewDate])

  const agendaGroups = useMemo(() => {
    const upcoming = visibleItems
      .filter((i) => i.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    const groups = new Map<string, CalItem[]>()
    for (const i of upcoming) {
      const arr = groups.get(i.date) ?? []
      arr.push(i)
      groups.set(i.date, arr)
    }
    return Array.from(groups.entries()).slice(0, 30)
  }, [visibleItems, today])

  const selectedItems = selectedDate ? byDate.get(selectedDate) ?? [] : []
  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  function shiftMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }
  function toggleType(type: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }
  function toggleVenue(id: number) {
    setActiveVenues((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function openCreate(date?: string) {
    setEditing(null)
    setDialogDate(date ?? selectedDate ?? today)
    setDialogOpen(true)
  }
  function openEdit(ev: DbCalendarEvent) {
    setEditing(ev)
    setDialogDate(ev.date)
    setDialogOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Events, tasks and bookings for this location on one shared schedule."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setMode("month")}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "month" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setMode("agenda")}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "agenda" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Agenda
              </button>
            </div>
            <Button onClick={() => openCreate()}>
              <Plus className="size-4" /> New entry
            </Button>
          </div>
        }
      />

      {/* Type filters / legend */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TYPE_ORDER.map((type) => {
          const meta = TYPE_META[type]
          const active = activeTypes.has(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-border bg-card text-foreground"
                  : "border-transparent bg-muted text-muted-foreground",
              )}
              aria-pressed={active}
            >
              <span className={cn("size-2.5 rounded-full", COLOR_DOT[meta.defaultColor], !active && "opacity-40")} />
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Venue filter (only when the user can see more than one venue) */}
      {multiVenue && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5" /> Venues
          </span>
          {venues.map((v) => {
            const active = activeVenues.has(v.id)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleVenue(v.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-border bg-card text-foreground"
                    : "border-transparent bg-muted text-muted-foreground",
                )}
                aria-pressed={active}
              >
                {v.name}
              </button>
            )
          })}
        </div>
      )}

      {mode === "month" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Month toolbar */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-pretty text-lg font-semibold tracking-tight">{monthLabel}</h2>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setViewDate(new Date())}>
                    Today
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => shiftMonth(-1)}>
                    <ChevronLeft className="size-4" />
                    <span className="sr-only">Previous month</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => shiftMonth(1)}>
                    <ChevronRight className="size-4" />
                    <span className="sr-only">Next month</span>
                  </Button>
                </div>
              </div>

              {/* Weekday header */}
              <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7">
                {gridDays.map((d, idx) => {
                  const iso = toISO(d)
                  const inMonth = d.getMonth() === viewDate.getMonth()
                  const isToday = iso === today
                  const isSelected = iso === selectedDate
                  const dayItems = byDate.get(iso) ?? []
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDate(iso)}
                      onDoubleClick={() => openCreate(iso)}
                      className={cn(
                        "flex min-h-24 flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-muted/50",
                        idx % 7 === 0 && "border-l",
                        !inMonth && "bg-muted/20",
                        isSelected && "ring-2 ring-ring ring-inset",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center self-start rounded-full text-xs font-medium",
                          isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <div className="flex flex-col gap-1">
                        {dayItems.slice(0, 3).map((it) => (
                          <span
                            key={it.key}
                            className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] leading-tight text-secondary-foreground"
                          >
                            <span className={cn("size-1.5 shrink-0 rounded-full", COLOR_DOT[it.color])} />
                            <span className="truncate">{it.title}</span>
                          </span>
                        ))}
                        {dayItems.length > 3 && (
                          <span className="px-1.5 text-[11px] text-muted-foreground">+{dayItems.length - 3} more</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected day panel */}
          <Card className="h-fit">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Selected day</p>
                  <h3 className="text-pretty font-heading text-base font-semibold">
                    {selectedDate ? prettyDate(selectedDate) : "—"}
                  </h3>
                </div>
                <Button size="sm" variant="outline" onClick={() => openCreate(selectedDate ?? undefined)}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>
              {selectedItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing scheduled. Double-click a day or use Add to create an entry.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {selectedItems.map((it) => (
                    <DayItemRow
                      key={it.key}
                      item={it}
                      venueName={multiVenue ? venueNameById.get(it.venueId) : undefined}
                      onEdit={() => it.source && openEdit(it.source)}
                      onDelete={() => it.source && setPendingDelete(it.source)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            {agendaGroups.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No upcoming entries. Create one to populate your agenda.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {agendaGroups.map(([date, dayItems]) => (
                  <div key={date} className="grid gap-3 sm:grid-cols-[140px_1fr]">
                    <div className="flex items-start gap-2 pt-1">
                      <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                      <span className={cn("text-sm font-medium", date === today ? "text-primary" : "text-foreground")}>
                        {date === today ? "Today" : prettyDate(date)}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {dayItems.map((it) => (
                        <DayItemRow
                          key={it.key}
                          item={it}
                          venueName={multiVenue ? venueNameById.get(it.venueId) : undefined}
                          onEdit={() => it.source && openEdit(it.source)}
                          onDelete={() => it.source && setPendingDelete(it.source)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <EventDialog
        key={editing ? `edit-${editing.id}` : `new-${dialogDate}`}
        venueId={venueId}
        venues={venues}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        defaultDate={dialogDate ?? today}
        linkable={linkable}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete calendar entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.title}" will be removed from the calendar. This can't be undone.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <DeleteConfirm event={pendingDelete} onDone={() => setPendingDelete(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------ Day item row ------------------------------ */

function DayItemRow({
  item,
  venueName,
  onEdit,
  onDelete,
}: {
  item: CalItem
  venueName?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const isLinkedSource = item.kind !== "calendar"
  return (
    <li className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5">
      <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", COLOR_DOT[item.color])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          {item.linkType && <Link2 className="size-3 shrink-0 text-muted-foreground" />}
          {item.assignedToMe && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Assigned to you
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{TYPE_META[item.type]?.label ?? item.type}</span>
          {venueName && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3" /> {venueName}
            </span>
          )}
          {!item.allDay && item.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {item.time}
            </span>
          )}
          {item.allDay && <span>All day</span>}
          {item.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {item.location}
            </span>
          )}
          <span>{item.status}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {isLinkedSource ? (
          item.href && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              render={<Link href={item.href} aria-label="Open source record" />}
            >
              <ExternalLink className="size-3.5" />
            </Button>
          )
        ) : (
          <>
            <Button variant="ghost" size="icon" className="size-7" onClick={onEdit} aria-label="Edit entry">
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={onDelete} aria-label="Delete entry">
              <Trash2 className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function DeleteConfirm({ event, onDone }: { event: DbCalendarEvent | null; onDone: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function handle() {
    if (!event) return
    setBusy(true)
    try {
      await deleteCalendarEvent(event.id)
      router.refresh()
    } finally {
      setBusy(false)
      onDone()
    }
  }
  return (
    <AlertDialogAction onClick={handle} disabled={busy}>
      {busy ? "Deleting..." : "Delete"}
    </AlertDialogAction>
  )
}

/* ------------------------------ Event dialog ------------------------------ */

function EventDialog({
  venueId,
  venues,
  open,
  onOpenChange,
  editing,
  defaultDate,
  linkable,
}: {
  venueId: number
  venues: WorkspaceVenue[]
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: DbCalendarEvent | null
  defaultDate: string
  linkable: LinkableItems
}) {
  const router = useRouter()
  const isEdit = !!editing
  const multiVenue = venues.length > 1

  // New entries can target any accessible venue; edits keep their own venue.
  const [selectedVenueId, setSelectedVenueId] = useState<number>(editing?.venueId ?? venueId)
  const [title, setTitle] = useState(editing?.title ?? "")
  const [type, setType] = useState(editing?.type ?? "event")
  const [color, setColor] = useState<ColorKey>((editing?.color as ColorKey) ?? "blue")
  const [date, setDate] = useState(editing?.date ?? defaultDate)
  const [endDate, setEndDate] = useState(editing?.endDate ?? "")
  const [allDay, setAllDay] = useState(editing?.allDay ?? true)
  const [startTime, setStartTime] = useState(editing?.startTime ?? "")
  const [endTime, setEndTime] = useState(editing?.endTime ?? "")
  const [location, setLocation] = useState(editing?.location ?? "")
  const [description, setDescription] = useState(editing?.description ?? "")
  const [status, setStatus] = useState(editing?.status ?? "Scheduled")
  const [linkType, setLinkType] = useState<CalendarLinkType | "none">(
    (editing?.linkType as CalendarLinkType) ?? "none",
  )
  const [linkId, setLinkId] = useState<number | null>(editing?.linkId ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onLinkTypeChange(value: CalendarLinkType | "none" | null) {
    setLinkType((value as CalendarLinkType | "none") ?? "none")
    setLinkId(null)
  }

  function onLinkItemChange(value: string | null) {
    if (!value) return
    const id = Number(value)
    setLinkId(id)
    // Prefill title / date from the chosen record where possible.
    if (linkType === "event") {
      const ev = linkable.events.find((e) => e.id === id)
      if (ev) {
        if (!title.trim()) setTitle(ev.name)
        setType("event")
      }
    } else if (linkType === "task") {
      const t = linkable.tasks.find((x) => x.id === id)
      if (t) {
        if (!title.trim()) setTitle(t.title)
        setType("task")
        setColor("gold")
      }
    } else if (linkType === "taskCheck") {
      const c = linkable.taskChecks.find((x) => x.id === id)
      if (c) {
        if (!title.trim()) setTitle(c.title)
        setType("task")
        setColor("gold")
        if (c.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(c.dueDate)) setDate(c.dueDate)
      }
    }
  }

  const linkChoices =
    linkType === "event"
      ? linkable.events.map((e) => ({ id: e.id, label: e.name, hint: e.date ?? undefined }))
      : linkType === "task"
        ? linkable.tasks.map((t) => ({ id: t.id, label: t.title, hint: t.due ?? undefined }))
        : linkType === "taskCheck"
          ? linkable.taskChecks.map((c) => ({ id: c.id, label: c.title, hint: c.dueDate ?? undefined }))
          : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError("Title is required.")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Please choose a date.")
    setSaving(true)
    setError(null)
    const payload = {
      venueId: selectedVenueId,
      title,
      description,
      date,
      endDate,
      startTime,
      endTime,
      allDay,
      type,
      color,
      location,
      linkType: linkType === "none" ? null : linkType,
      linkId: linkType === "none" ? null : linkId,
      status,
    }
    try {
      if (isEdit && editing) await updateCalendarEvent(editing.id, payload)
      else await createCalendarEvent(payload)
      router.refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit calendar entry" : "New calendar entry"}</DialogTitle>
          <DialogDescription>
            Schedule an event, task, booking or reminder — and optionally link it to an existing record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid max-h-[70vh] gap-4 overflow-y-auto px-0.5">
          {multiVenue && !isEdit && (
            <div className="grid gap-2">
              <Label htmlFor="cal-venue">Venue</Label>
              <Select
                value={String(selectedVenueId)}
                onValueChange={(v) => v && setSelectedVenueId(Number(v))}
              >
                <SelectTrigger id="cal-venue">
                  <SelectValue placeholder="Choose a venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {multiVenue && isEdit && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="size-3.5" />
              {venues.find((v) => v.id === selectedVenueId)?.name ?? "This venue"}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="cal-title">Title</Label>
            <Input
              id="cal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Saturday live music"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cal-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  const next = v ?? "event"
                  setType(next)
                  setColor(TYPE_META[next]?.defaultColor ?? "blue")
                }}
              >
                <SelectTrigger id="cal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cal-color">Colour</Label>
              <Select value={color} onValueChange={(v) => setColor((v as ColorKey) ?? "blue")}>
                <SelectTrigger id="cal-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2.5 rounded-full", COLOR_DOT[c.value])} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cal-date">Date</Label>
              <Input id="cal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cal-enddate">End date (optional)</Label>
              <Input id="cal-enddate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="cal-allday" checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} />
            <Label htmlFor="cal-allday" className="font-normal">All day</Label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="cal-start">Start time</Label>
                <Input id="cal-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cal-end">End time</Label>
                <Input id="cal-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="cal-location">Location (optional)</Label>
            <Input
              id="cal-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Main bar"
            />
          </div>

          {/* Link section */}
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Link2 className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Link to a record</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="cal-linktype" className="text-xs text-muted-foreground">Record type</Label>
                <Select value={linkType} onValueChange={onLinkTypeChange}>
                  <SelectTrigger id="cal-linktype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No link</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="task">Operations task</SelectItem>
                    <SelectItem value="taskCheck">Task check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {linkType !== "none" && (
                <div className="grid gap-2">
                  <Label htmlFor="cal-linkitem" className="text-xs text-muted-foreground">Record</Label>
                  <Select value={linkId != null ? String(linkId) : ""} onValueChange={onLinkItemChange}>
                    <SelectTrigger id="cal-linkitem">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {linkChoices.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          Nothing to link
                        </SelectItem>
                      ) : (
                        linkChoices.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.label}
                            {c.hint ? ` · ${c.hint}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cal-desc">Notes (optional)</Label>
            <Textarea
              id="cal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything the team should know…"
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
