"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Plus,
  Truck,
  Wrench,
  CalendarDays,
  ListChecks,
  MoreVertical,
  Pencil,
  Trash2,
  Link2,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  createEvent,
  createMaintenance,
  createTask,
  deleteEvent,
  deleteMaintenance,
  deleteTask,
  toggleTask,
  updateEventStatus,
  updateMaintenanceStatus,
} from "@/app/actions/operations"
import type {
  DbEvent,
  DbMaintenance,
  DbTask,
} from "@/lib/db/schema"
import { cn } from "@/lib/utils"

export interface AssetOption {
  id: number
  assetNumber: string
  name: string
}

const priorityClasses: Record<string, string> = {
  High: "bg-destructive/12 text-destructive",
  Medium: "bg-chart-4/20 text-[oklch(0.45_0.11_70)]",
  Low: "bg-muted text-muted-foreground",
}

const maintenanceStatuses = ["Open", "In progress", "Resolved"]
const eventStatuses = ["Enquiry", "Provisional", "Confirmed"]
const priorities = ["Low", "Medium", "High"]

// Renders a stored date, formatting ISO (YYYY-MM-DD) values for display and
// passing through any legacy free-text dates unchanged.
function formatMaybeIso(value: string | null | undefined): string {
  if (!value) return "—"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }
  return value
}

function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string
  onEdit?: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <MoreVertical className="size-4" />
            <span className="sr-only">{label}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* --------------------------- Maintenance dialog --------------------------- */

const CUSTOM_ASSET = "__custom__"

function MaintenanceDialog({
  venueId,
  assetOptions,
}: {
  venueId: number
  assetOptions: AssetOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Either the id of a registered asset (as a string) or CUSTOM_ASSET for free text.
  const [assetChoice, setAssetChoice] = useState<string>(
    assetOptions.length > 0 ? String(assetOptions[0].id) : CUSTOM_ASSET,
  )
  const [customAsset, setCustomAsset] = useState("")
  const [issue, setIssue] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [assignee, setAssignee] = useState("")
  const [status, setStatus] = useState("Open")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustom = assetChoice === CUSTOM_ASSET
  const selectedAsset = isCustom ? null : assetOptions.find((a) => String(a.id) === assetChoice)

  function reset() {
    setAssetChoice(assetOptions.length > 0 ? String(assetOptions[0].id) : CUSTOM_ASSET)
    setCustomAsset("")
    setIssue("")
    setPriority("Medium")
    setAssignee("")
    setStatus("Open")
    setDate("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const assetName = isCustom ? customAsset.trim() : selectedAsset?.name ?? ""
    if (!assetName) return setError("Asset is required.")
    setSaving(true)
    setError(null)
    try {
      await createMaintenance({
        venueId,
        assetName,
        assetId: selectedAsset?.id ?? null,
        issue,
        priority,
        assignee,
        status,
        scheduledDate: date || null,
      })
      reset()
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log job.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-1.5">
            <Plus className="size-4" /> Log job
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log maintenance job</DialogTitle>
          <DialogDescription>Record a fault or scheduled service.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mnt-asset">Asset</Label>
            <Select value={assetChoice} onValueChange={(v) => v && setAssetChoice(v)}>
              <SelectTrigger id="mnt-asset">
                <SelectValue placeholder="Select an asset" />
              </SelectTrigger>
              <SelectContent>
                {assetOptions.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name} · {a.assetNumber}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_ASSET}>Other (not registered)</SelectItem>
              </SelectContent>
            </Select>
            {isCustom && (
              <Input
                aria-label="Asset name"
                value={customAsset}
                onChange={(e) => setCustomAsset(e.target.value)}
                placeholder="Glasswasher — Bar 2"
              />
            )}
            {selectedAsset && (
              <p className="text-xs text-muted-foreground">
                Linked to {selectedAsset.assetNumber} in Asset Tracking.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mnt-issue">Issue</Label>
            <Input id="mnt-issue" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Not reaching temperature" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="mnt-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "Medium")}>
                <SelectTrigger id="mnt-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="mnt-assignee">Assignee</Label>
              <Input id="mnt-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Dan O." />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mnt-date">Scheduled date</Label>
            <Input id="mnt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Add a date to show this job on the shared calendar.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Log job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ Event dialog ------------------------------ */

function EventDialog({ venueId }: { venueId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [covers, setCovers] = useState("")
  const [status, setStatus] = useState("Provisional")
  const [owner, setOwner] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Event name is required.")
    setSaving(true)
    setError(null)
    try {
      await createEvent({
        venueId,
        name,
        date,
        covers: Number.parseInt(covers, 10) || 0,
        status,
        owner,
      })
      setName("")
      setDate("")
      setCovers("")
      setStatus("Provisional")
      setOwner("")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-1.5">
            <Plus className="size-4" /> Add event
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add event</DialogTitle>
          <DialogDescription>Book a function, party or live night.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ev-name">Name</Label>
            <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday Live Music" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ev-date">Date</Label>
              <Input id="ev-date" value={date} onChange={(e) => setDate(e.target.value)} placeholder="Sat 14 Jun" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-covers">Covers</Label>
              <Input id="ev-covers" type="number" min="0" value={covers} onChange={(e) => setCovers(e.target.value)} placeholder="120" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "Provisional")}>
                <SelectTrigger id="ev-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ev-owner">Owner</Label>
            <Input id="ev-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Sarah W." />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- Task dialog ------------------------------ */

function TaskDialog({ venueId }: { venueId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [area, setArea] = useState("")
  const [assignee, setAssignee] = useState("")
  const [due, setDue] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError("Task title is required.")
    setSaving(true)
    setError(null)
    try {
      await createTask({ venueId, title, area, assignee, due, priority })
      setTitle("")
      setArea("")
      setAssignee("")
      setDue("")
      setPriority("Medium")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-1.5">
            <Plus className="size-4" /> Add task
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>Assign a job to the team.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Stock count — spirits" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="task-area">Area</Label>
              <Input id="task-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Bar" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Input id="task-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Priya N." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="task-due">Due</Label>
              <Input id="task-due" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Today" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "Medium")}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- Main view -------------------------------- */

export function OperationsView({
  venueId,
  maintenance,
  events,
  tasks,
  assetOptions,
}: {
  venueId: number
  maintenance: DbMaintenance[]
  events: DbEvent[]
  tasks: DbTask[]
  assetOptions: AssetOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = ["maintenance", "events", "tasks"].includes(
    searchParams.get("tab") ?? "",
  )
    ? (searchParams.get("tab") as string)
    : "maintenance"
  const [tab, setTab] = useState(initialTab)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Keep the active tab in sync with the ?tab= param so deep links (e.g. from
  // global search) switch tabs even when already on this page.
  const tabParam = searchParams.get("tab")
  useEffect(() => {
    if (tabParam && ["maintenance", "events", "tasks"].includes(tabParam)) {
      setTab(tabParam)
    }
  }, [tabParam])
  const [deleting, setDeleting] = useState<{ kind: string; id: number; label: string } | null>(null)
  const [removing, setRemoving] = useState(false)

  const summary = useMemo(
    () => [
      { label: "Maintenance jobs", value: maintenance.filter((m) => m.status !== "Resolved").length, icon: Wrench },
      { label: "Upcoming events", value: events.length, icon: CalendarDays },
      { label: "Tasks due", value: tasks.filter((t) => !t.done).length, icon: ListChecks },
    ],
    [maintenance, events, tasks],
  )

  const headerAction =
    tab === "maintenance" ? (
      <MaintenanceDialog venueId={venueId} assetOptions={assetOptions} />
    ) : tab === "events" ? (
      <EventDialog venueId={venueId} />
    ) : (
      <TaskDialog venueId={venueId} />
    )

  async function runStatus(key: string, fn: () => Promise<void>) {
    setBusyId(key)
    try {
      await fn()
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setRemoving(true)
    try {
      if (deleting.kind === "maintenance") await deleteMaintenance(deleting.id)
      else if (deleting.kind === "event") await deleteEvent(deleting.id)
      else if (deleting.kind === "task") await deleteTask(deleting.id)
      setDeleting(null)
      router.refresh()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Operations"
        description="Maintenance, events and day-to-day tasks."
        actions={headerAction}
      />

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)} className="mt-2">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max">
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>
        </div>

        {/* Maintenance */}
        <TabsContent value="maintenance" className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {summary.map((s) => {
              const Icon = s.icon
              return (
                <Card key={s.label} className="gap-0 p-4">
                  <Icon className="size-4 text-muted-foreground" />
                  <p className="mt-2 text-2xl font-semibold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </Card>
              )
            })}
          </div>
          <Card>
            <CardContent className="p-0">
              {maintenance.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  No maintenance jobs. Use “Log job” to record one.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenance.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {m.assetName}
                            {m.assetId != null && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"
                                title="Linked to Asset Tracking"
                              >
                                <Link2 className="size-3" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.issue}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("border-transparent font-medium", priorityClasses[m.priority])}
                          >
                            {m.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{m.assignee}</TableCell>
                        <TableCell className="text-muted-foreground">{formatMaybeIso(m.scheduledDate ?? m.loggedDate)}</TableCell>
                        <TableCell>
                          <Select
                            value={m.status}
                            onValueChange={(v) => v && runStatus(`mnt-${m.id}`, () => updateMaintenanceStatus(m.id, v))}
                            disabled={busyId === `mnt-${m.id}`}
                          >
                            <SelectTrigger size="sm" className="w-36" aria-label={`Status for ${m.assetName}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {maintenanceStatuses.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <RowActions
                            label={`Actions for ${m.assetName}`}
                            onDelete={() => setDeleting({ kind: "maintenance", id: m.id, label: m.assetName })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events */}
        <TabsContent value="events">
          {events.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No events yet. Use “Add event” to book one.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => (
                <Card key={ev.id}>
                  <CardContent>
                    <div className="flex items-start justify-between gap-2">
                      <CalendarDays className="size-5 text-primary" />
                      <div className="flex items-center gap-1">
                        <StatusBadge status={ev.status} />
                        <RowActions
                          label={`Actions for ${ev.name}`}
                          onDelete={() => setDeleting({ kind: "event", id: ev.id, label: ev.name })}
                        />
                      </div>
                    </div>
                    <p className="mt-3 font-medium text-foreground">{ev.name}</p>
                    <p className="text-sm text-muted-foreground">{ev.date}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                      <span className="text-muted-foreground">{ev.covers} covers</span>
                      <Select
                        value={ev.status}
                        onValueChange={(v) => v && runStatus(`ev-${ev.id}`, () => updateEventStatus(ev.id, v))}
                        disabled={busyId === `ev-${ev.id}`}
                      >
                        <SelectTrigger size="sm" className="w-32" aria-label={`Status for ${ev.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {eventStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks">
          <Card>
            <CardContent className="flex flex-col gap-1 p-2">
              {tasks.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No tasks yet. Use “Add task” to create one.
                </p>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-secondary"
                  >
                    <Checkbox
                      checked={t.done}
                      disabled={busyId === `task-${t.id}`}
                      onCheckedChange={(c) => runStatus(`task-${t.id}`, () => toggleTask(t.id, c === true))}
                      aria-label={`Mark ${t.title} ${t.done ? "incomplete" : "complete"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          t.done ? "text-muted-foreground line-through" : "text-foreground",
                        )}
                      >
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.area} · {t.assignee}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("border-transparent font-medium", priorityClasses[t.priority])}
                    >
                      {t.priority}
                    </Badge>
                    <span className="w-20 text-right text-xs text-muted-foreground">{t.due}</span>
                    <RowActions
                      label={`Actions for ${t.title}`}
                      onDelete={() => setDeleting({ kind: "task", id: t.id, label: t.title })}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {deleting?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{deleting?.label}”. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={removing}>
              {removing ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
