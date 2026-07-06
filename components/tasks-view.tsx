"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import {
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Camera,
  X,
  Calendar,
  User,
  Repeat,
  Loader2,
  ImageIcon,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ROTA_DAYS } from "@/lib/rota"
import {
  createTaskCheck,
  updateTaskCheck,
  toggleTaskItem,
  updateTaskStatus,
  deleteTaskCheck,
  createCorrectiveAction,
  updateCorrectiveActionStatus,
  deleteCorrectiveAction,
  type TaskWithItems,
} from "@/app/actions/tasks"
import type {
  DbCorrectiveAction,
  DbStaffMember,
  DbMeterReading,
  DbOpsDocument,
} from "@/lib/db/schema"
import type { MeetingWithActions } from "@/app/actions/oversight"
import { MeetingsPanel } from "@/components/tasks/meetings-panel"
import { MeterReadingsPanel } from "@/components/tasks/meter-readings-panel"
import { DocumentsPanel } from "@/components/tasks/documents-panel"

const TASK_CATEGORIES = ["Opening", "Closing", "Cleaning", "Food Safety", "Cellar", "Maintenance", "Checklist"]
const FREQUENCIES = ["One-off", "Daily", "Set days", "Weekly", "Monthly"]
const PRIORITIES = ["Low", "Medium", "High"]

type Props = {
  venueId: number
  initialTasks: TaskWithItems[]
  initialActions: DbCorrectiveAction[]
  staff: DbStaffMember[]
  initialMeetings: MeetingWithActions[]
  initialMeterReadings: DbMeterReading[]
  initialDocuments: DbOpsDocument[]
}

/** Friendly assignment label from a task's staff/role/on-shift/legacy fields. */
function assigneeLabel(
  task: Pick<TaskWithItems, "assigneeStaffId" | "assigneeRole" | "assignOnShift" | "assignee">,
  staffById: Map<number, string>,
): string | null {
  if (task.assigneeStaffId != null) return staffById.get(task.assigneeStaffId) ?? "Staff member"
  if (task.assigneeRole) return `${task.assigneeRole} (role)`
  if (task.assignOnShift) return "Whoever's on shift"
  return task.assignee || null
}

async function uploadImage(file: File): Promise<string> {
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

function priorityTone(priority: string) {
  if (priority === "High") return "bg-destructive/12 text-destructive"
  if (priority === "Medium") return "bg-chart-4/20 text-[oklch(0.45_0.11_70)]"
  return "bg-muted text-muted-foreground"
}

export function TasksView({
  venueId,
  initialTasks,
  initialActions,
  staff,
  initialMeetings,
  initialMeterReadings,
  initialDocuments,
}: Props) {
  const searchParams = useSearchParams()
  const startMeetingId = searchParams.get("startMeeting")
  const initialTab = searchParams.get("tab") === "meetings" || startMeetingId ? "meetings" : "tasks"

  const [tasks, setTasks] = useState<TaskWithItems[]>(initialTasks)
  const [actions, setActions] = useState<DbCorrectiveAction[]>(initialActions)
  const [statusFilter, setStatusFilter] = useState<string>("All")

  const staffById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of staff) m.set(s.id, s.name)
    return m
  }, [staff])

  const roles = useMemo(() => Array.from(new Set(staff.map((s) => s.role).filter(Boolean))), [staff])

  // Templates drive recurrence; the active board shows real to-dos only.
  const templates = useMemo(() => tasks.filter((t) => t.recurring), [tasks])
  const activeTasks = useMemo(() => tasks.filter((t) => !t.recurring), [tasks])

  const stats = useMemo(() => {
    const total = activeTasks.length
    const completed = activeTasks.filter((t) => t.status === "Completed").length
    const overdue = activeTasks.filter((t) => t.status === "Overdue").length
    const openActions = actions.filter((a) => a.status !== "Resolved").length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, overdue, openActions, rate }
  }, [activeTasks, actions])

  const filteredTasks = useMemo(() => {
    if (statusFilter === "All") return activeTasks
    return activeTasks.filter((t) => t.status === statusFilter)
  }, [activeTasks, statusFilter])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Task Management"
        description="Assign, track and verify the recurring jobs that keep your venue running — with checklist steps and photo proof."
        actions={
          <TaskFormDialog
            venueId={venueId}
            staff={staff}
            roles={roles}
            trigger={
              <Button>
                <Plus className="size-4" />
                New task
              </Button>
            }
            onSaved={(t) =>
              setTasks((prev) =>
                prev.some((p) => p.id === t.id) ? prev.map((p) => (p.id === t.id ? t : p)) : [t, ...prev],
              )
            }
          />
        }
      />

      <Tabs defaultValue={initialTab} className="w-full">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max">
            <TabsTrigger value="tasks">Tasks &amp; Checklists</TabsTrigger>
            <TabsTrigger value="recurring">
              Recurring
              {templates.length > 0 && (
                <Badge variant="outline" className="ml-2 border-transparent bg-muted text-muted-foreground">
                  {templates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions">
              Corrective Actions
              {stats.openActions > 0 && (
                <Badge variant="outline" className="ml-2 border-transparent bg-destructive/12 text-destructive">
                  {stats.openActions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="meters">Meter Readings</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="mt-5 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Active tasks" value={String(stats.total)} icon={ListChecks} tone="text-chart-3" />
            <KpiTile label="Completed" value={String(stats.completed)} icon={CheckCircle2} tone="text-chart-2" />
            <KpiTile label="Overdue" value={String(stats.overdue)} icon={Clock} tone="text-destructive" />
            <KpiTile label="Open actions" value={String(stats.openActions)} icon={AlertTriangle} tone="text-chart-4" />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Completion rate</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stats.completed} of {stats.total} tasks completed today
                </p>
              </div>
              <span className="text-2xl font-semibold tracking-tight">{stats.rate}%</span>
            </CardHeader>
            <CardContent>
              <Progress value={stats.rate} />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            {["All", "Pending", "In progress", "Completed", "Overdue"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks here yet"
              description="Create a task or checklist to assign recurring jobs to your team."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  staffById={staffById}
                  staff={staff}
                  roles={roles}
                  onChange={(updated) =>
                    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                  }
                  onDelete={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
                  onRaiseAction={(a) => setActions((prev) => [a, ...prev])}
                  venueId={venueId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recurring" className="mt-5">
          {templates.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No recurring tasks"
              description="Turn on 'Repeat automatically' when creating a task to generate a fresh to-do every day, week or month."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {templates.map((tmpl) => (
                <RecurringTemplateCard
                  key={tmpl.id}
                  template={tmpl}
                  assignee={assigneeLabel(tmpl, staffById)}
                  staff={staff}
                  roles={roles}
                  venueId={venueId}
                  onChange={(updated) =>
                    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                  }
                  onDelete={(id) => setTasks((prev) => prev.filter((t) => t.id !== id && t.recurrenceParentId !== id))}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="mt-5">
          <div className="mb-4 flex justify-end">
            <CreateActionDialog
              venueId={venueId}
              onCreated={(a) => setActions((prev) => [a, ...prev])}
            />
          </div>
          {actions.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No corrective actions"
              description="When a task fails a check, raise a corrective action to track the fix."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onChange={(updated) =>
                    setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                  }
                  onDelete={(id) => setActions((prev) => prev.filter((a) => a.id !== id))}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="meetings" className="mt-5">
          <MeetingsPanel
            venueId={venueId}
            initialMeetings={initialMeetings}
            staff={staff}
            startMeetingId={startMeetingId ? Number(startMeetingId) : null}
          />
        </TabsContent>

        <TabsContent value="meters" className="mt-5">
          <MeterReadingsPanel venueId={venueId} initialReadings={initialMeterReadings} />
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          <DocumentsPanel venueId={venueId} initialDocuments={initialDocuments} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: typeof ListChecks
  tone: string
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", tone)} />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </Card>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ListChecks
  title: string
  description: string
}) {
  return (
    <Card className="items-center gap-2 border-dashed py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </Card>
  )
}

function TaskCard({
  task,
  staffById,
  staff,
  roles,
  onChange,
  onDelete,
  onRaiseAction,
  venueId,
}: {
  task: TaskWithItems
  staffById: Map<number, string>
  staff: DbStaffMember[]
  roles: string[]
  onChange: (t: TaskWithItems) => void
  onDelete: (id: number) => void
  onRaiseAction: (a: DbCorrectiveAction) => void
  venueId: number
}) {
  const assignee = assigneeLabel(task, staffById)
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doneCount = task.items.filter((i) => i.done).length
  const allDone = task.items.length === 0 || doneCount === task.items.length

  function handleToggleItem(itemId: number, done: boolean) {
    const updatedItems = task.items.map((i) => (i.id === itemId ? { ...i, done } : i))
    onChange({ ...task, items: updatedItems })
    startTransition(() => {
      toggleTaskItem(itemId, done)
    })
  }

  function setStatus(status: string, photoUrl?: string) {
    onChange({
      ...task,
      status,
      photoUrl: photoUrl ?? task.photoUrl,
      completedAt: status === "Completed" ? new Date() : null,
    })
    startTransition(() => {
      updateTaskStatus({ taskId: task.id, status, completedBy: task.assignee ?? "Team", photoUrl })
    })
  }

  async function completeTask() {
    if (task.requiresPhoto && !task.photoUrl) {
      fileRef.current?.click()
      return
    }
    setStatus("Completed")
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadImage(file)
      setStatus("Completed", url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleDelete() {
    onDelete(task.id)
    startTransition(() => {
      deleteTaskCheck(task.id)
    })
  }

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                {task.category}
              </Badge>
              <Badge variant="outline" className={cn("border-transparent", priorityTone(task.priority))}>
                {task.priority}
              </Badge>
            </div>
            <CardTitle className="mt-2 text-base leading-snug">{task.title}</CardTitle>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {assignee && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3.5" />
              {assignee}
            </span>
          )}
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
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {task.items.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Checklist</span>
              <span>
                {doneCount}/{task.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {task.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={item.done}
                    onCheckedChange={(c) => handleToggleItem(item.id, c === true)}
                    disabled={task.status === "Completed"}
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    className={cn(
                      "text-sm",
                      item.done ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {task.notes && <p className="text-sm text-muted-foreground">{task.notes}</p>}

        {task.requiresPhoto && (
          <div className="rounded-md border border-dashed border-border p-3">
            {task.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={task.photoUrl || "/placeholder.svg"}
                alt="Task completion proof"
                className="h-32 w-full rounded object-cover"
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="size-4" />
                Photo proof required to complete
              </div>
            )}
          </div>
        )}

        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {task.status !== "Completed" ? (
            <>
              <Button size="sm" onClick={completeTask} disabled={pending || uploading || !allDone}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : task.requiresPhoto && !task.photoUrl ? (
                  <Camera className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {task.requiresPhoto && !task.photoUrl ? "Photo & complete" : "Mark complete"}
              </Button>
              {task.status === "Pending" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("In progress")} disabled={pending}>
                  Start
                </Button>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-chart-2">
              <CheckCircle2 className="size-4" />
              Completed{task.completedBy ? ` by ${task.completedBy}` : ""}
            </span>
          )}

          <RaiseActionButton task={task} venueId={venueId} onRaised={onRaiseAction} />

          <div className="ml-auto flex items-center gap-1">
            <TaskFormDialog
              venueId={venueId}
              staff={staff}
              roles={roles}
              task={task}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit task"
                >
                  <Pencil className="size-4" />
                </Button>
              }
              onSaved={onChange}
            />
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={pending}
              aria-label="Delete task"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RaiseActionButton({
  task,
  venueId,
  onRaised,
}: {
  task: TaskWithItems
  venueId: number
  onRaised: (a: DbCorrectiveAction) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(`Follow-up: ${task.title}`)
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState(task.priority)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const created = await createCorrectiveAction({
        venueId,
        title: title.trim() || `Follow-up: ${task.title}`,
        description: description.trim() || undefined,
        sourceTaskId: task.id,
        priority,
        assignee: task.assignee ?? undefined,
      })
      onRaised(created)
      setOpen(false)
      setDescription("")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <AlertTriangle className="size-4" />
            Raise action
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise corrective action</DialogTitle>
          <DialogDescription>Log a follow-up fix linked to “{task.title}”.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ca-title">Title</Label>
            <Input id="ca-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ca-desc">Description</Label>
            <Textarea
              id="ca-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs fixing?"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v ?? "Medium")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Raise action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ActionCard({
  action,
  onChange,
  onDelete,
}: {
  action: DbCorrectiveAction
  onChange: (a: DbCorrectiveAction) => void
  onDelete: (id: number) => void
}) {
  const [pending, startTransition] = useTransition()

  function setStatus(status: string) {
    onChange({ ...action, status, resolvedAt: status === "Resolved" ? new Date() : null })
    startTransition(() => {
      updateCorrectiveActionStatus(action.id, status)
    })
  }

  function handleDelete() {
    onDelete(action.id)
    startTransition(() => {
      deleteCorrectiveAction(action.id)
    })
  }

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border-transparent", priorityTone(action.priority))}>
              {action.priority}
            </Badge>
            <StatusBadge status={action.status} />
          </div>
          <p className="mt-2 font-medium text-foreground">{action.title}</p>
          {action.description && (
            <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {action.assignee && (
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" />
                {action.assignee}
              </span>
            )}
            {action.dueDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                {action.dueDate}
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={pending}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {action.status !== "Resolved" ? (
          <>
            {action.status === "Open" && (
              <Button size="sm" variant="outline" onClick={() => setStatus("In progress")} disabled={pending}>
                Start fixing
              </Button>
            )}
            <Button size="sm" onClick={() => setStatus("Resolved")} disabled={pending}>
              <CheckCircle2 className="size-4" />
              Mark resolved
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setStatus("Open")} disabled={pending}>
            Reopen
          </Button>
        )}
      </div>
    </Card>
  )
}

function RecurringTemplateCard({
  template,
  assignee,
  staff,
  roles,
  venueId,
  onChange,
  onDelete,
}: {
  template: TaskWithItems
  assignee: string | null
  staff: DbStaffMember[]
  roles: string[]
  venueId: number
  onChange: (t: TaskWithItems) => void
  onDelete: (id: number) => void
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    onDelete(template.id)
    startTransition(() => {
      deleteTaskCheck(template.id)
    })
  }

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-transparent bg-chart-3/15 text-chart-3">
              <Repeat className="size-3" />
              {template.frequency === "Set days" && template.repeatDays
                ? template.repeatDays.split(",").join(", ")
                : template.frequency}
            </Badge>
            <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
              {template.category}
            </Badge>
            <Badge variant="outline" className={cn("border-transparent", priorityTone(template.priority))}>
              {template.priority}
            </Badge>
          </div>
          <p className="mt-2 font-medium text-foreground">{template.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {assignee && (
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" />
                {assignee}
              </span>
            )}
            {template.items.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3.5" />
                {template.items.length} steps
              </span>
            )}
            <span>
              {template.frequency === "Set days" && template.repeatDays
                ? `Auto-generates on ${template.repeatDays.split(",").join(", ")}.`
                : `Auto-generates a fresh to-do every ${template.frequency.toLowerCase().replace("ly", "")}.`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TaskFormDialog
            venueId={venueId}
            staff={staff}
            roles={roles}
            task={template}
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Edit recurring task"
              >
                <Pencil className="size-4" />
              </Button>
            }
            onSaved={onChange}
          />
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={pending}
            aria-label="Delete recurring task"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

type AssignMode = "unassigned" | "person" | "role" | "on-shift"

function assignModeOf(task: TaskWithItems): AssignMode {
  if (task.assigneeStaffId != null) return "person"
  if (task.assigneeRole) return "role"
  if (task.assignOnShift) return "on-shift"
  return "unassigned"
}

function TaskFormDialog({
  venueId,
  staff,
  roles,
  task,
  trigger,
  onSaved,
}: {
  venueId: number
  staff: DbStaffMember[]
  roles: string[]
  /** When provided, the dialog edits this task instead of creating a new one. */
  task?: TaskWithItems
  trigger: React.ReactElement
  onSaved: (t: TaskWithItems) => void
}) {
  const isEdit = !!task
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const buildInitialForm = () => ({
    title: task?.title ?? "",
    category: task?.category ?? "Opening",
    assignMode: (task ? assignModeOf(task) : "unassigned") as AssignMode,
    assigneeStaffId: task?.assigneeStaffId != null ? String(task.assigneeStaffId) : "",
    assigneeRole: task?.assigneeRole ?? roles[0] ?? "",
    dueDate: task?.dueDate ?? "",
    dueTime: task?.dueTime ?? "",
    frequency: task?.frequency ?? "Daily",
    repeatDays: task?.repeatDays
      ? task.repeatDays.split(",").map((s) => s.trim()).filter(Boolean)
      : ([] as string[]),
    priority: task?.priority ?? "Medium",
    requiresPhoto: task?.requiresPhoto ?? false,
    recurring: task ? task.recurring : true,
    notes: task?.notes ?? "",
  })

  const [form, setForm] = useState(buildInitialForm)
  const [itemsText, setItemsText] = useState(task ? task.items.map((i) => i.label).join("\n") : "")

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      repeatDays: f.repeatDays.includes(day)
        ? f.repeatDays.filter((d) => d !== day)
        : [...f.repeatDays, day],
    }))
  }

  // Sync the form to the latest values every time the dialog opens; on create,
  // that clears it back to defaults, on edit it reflects the current task.
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setForm(buildInitialForm())
      setItemsText(task ? task.items.map((i) => i.label).join("\n") : "")
      setError(null)
    }
  }

  const canRecur = form.frequency !== "One-off"

  function submit() {
    if (!form.title.trim()) {
      setError("Task title is required")
      return
    }
    if (form.assignMode === "person" && !form.assigneeStaffId) {
      setError("Choose a staff member, or change who it's assigned to")
      return
    }
    if (form.assignMode === "role" && !form.assigneeRole) {
      setError("Choose a role, or change who it's assigned to")
      return
    }
    if (form.assignMode === "on-shift" && !form.dueDate) {
      setError("Add a due date so we can tell who's on shift then")
      return
    }
    if (form.frequency === "Set days" && form.repeatDays.length === 0) {
      setError("Pick at least one day for the task to repeat on")
      return
    }
    startTransition(async () => {
      try {
        const items = itemsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
        const assigneeStaffId =
          form.assignMode === "person" && form.assigneeStaffId ? Number(form.assigneeStaffId) : null
        const assigneeRole = form.assignMode === "role" ? form.assigneeRole : null
        const shared = {
          title: form.title.trim(),
          category: form.category,
          assigneeStaffId,
          assigneeRole,
          assignOnShift: form.assignMode === "on-shift",
          dueDate: form.dueDate || undefined,
          dueTime: form.dueTime || undefined,
          frequency: form.frequency,
          repeatDays:
            form.frequency === "Set days"
              ? ROTA_DAYS.filter((d) => form.repeatDays.includes(d)).join(",")
              : null,
          priority: form.priority,
          requiresPhoto: form.requiresPhoto,
          recurring: canRecur && form.recurring,
          notes: form.notes.trim() || undefined,
          items,
        }
        const saved =
          isEdit && task
            ? await updateTaskCheck({ taskId: task.id, ...shared })
            : await createTaskCheck({ venueId, ...shared })
        // Preserve completion state of matching existing items when editing.
        const prevItems = task?.items ?? []
        onSaved({
          ...saved,
          items: items.map((label, idx) => {
            const prior = prevItems.find((p) => p.label === label)
            return {
              id: prior?.id ?? -1 - idx,
              userId: saved.userId,
              taskId: saved.id,
              label,
              done: prior?.done ?? false,
              sortOrder: idx,
              createdAt: prior?.createdAt ?? new Date(),
            }
          }),
        })
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : isEdit ? "Could not update task" : "Could not create task")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this task's details, assignment and checklist."
              : "Build a recurring job or checklist and assign it to your team."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Cellar opening checks"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v ?? "Opening")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => update("priority", v ?? "Medium")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Assign to</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={form.assignMode}
                onValueChange={(v) => update("assignMode", (v as typeof form.assignMode) ?? "unassigned")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Anyone (unassigned)</SelectItem>
                  <SelectItem value="person">A staff member</SelectItem>
                  <SelectItem value="role" disabled={roles.length === 0}>
                    A whole role
                  </SelectItem>
                  <SelectItem value="on-shift">Whoever is on shift</SelectItem>
                </SelectContent>
              </Select>

              {form.assignMode === "person" ? (
                <Select
                  value={form.assigneeStaffId}
                  onValueChange={(v) => update("assigneeStaffId", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose person" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No staff added yet
                      </SelectItem>
                    ) : (
                      staff.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} · {s.role}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : form.assignMode === "role" ? (
                <Select value={form.assigneeRole} onValueChange={(v) => update("assigneeRole", v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : form.assignMode === "on-shift" ? (
                <div className="flex items-center text-xs text-muted-foreground">
                  Assigned to staff rostered on the published rota at the due date &amp; time.
                </div>
              ) : (
                <div className="flex items-center text-xs text-muted-foreground">
                  Any team member can pick this up.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => update("frequency", v ?? "Daily")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label
              className={cn(
                "flex items-center gap-2.5 self-end rounded-md border border-border p-2.5",
                !canRecur && "opacity-50",
              )}
            >
              <Checkbox
                checked={canRecur && form.recurring}
                disabled={!canRecur}
                onCheckedChange={(c) => update("recurring", c === true)}
              />
              <span className="flex items-center gap-1.5 text-sm">
                <Repeat className="size-4 text-muted-foreground" />
                Repeat automatically
              </span>
            </label>
          </div>

          {form.frequency === "Set days" && (
            <div className="flex flex-col gap-2">
              <Label>Repeat on</Label>
              <div className="flex flex-wrap gap-2">
                {ROTA_DAYS.map((day) => {
                  const active = form.repeatDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                A fresh instance is created automatically on each selected day.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-date">Due date</Label>
              <Input
                id="t-date"
                type="date"
                value={form.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-time">Due time</Label>
              <Input
                id="t-time"
                type="time"
                value={form.dueTime}
                onChange={(e) => update("dueTime", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="t-items">Checklist steps</Label>
            <Textarea
              id="t-items"
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder={"One step per line, e.g.\nCheck line pressure\nClean drip trays\nRecord cellar temp"}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">One step per line. Leave blank for a simple task.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="t-notes">Notes</Label>
            <Textarea
              id="t-notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any extra instructions"
              rows={2}
            />
          </div>

          <label className="flex items-center gap-2.5 rounded-md border border-border p-3">
            <Checkbox
              checked={form.requiresPhoto}
              onCheckedChange={(c) => update("requiresPhoto", c === true)}
            />
            <span className="flex items-center gap-1.5 text-sm">
              <ImageIcon className="size-4 text-muted-foreground" />
              Require photo proof to complete
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateActionDialog({
  venueId,
  onCreated,
}: {
  venueId: number
  onCreated: (a: DbCorrectiveAction) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    assignee: "",
    dueDate: "",
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit() {
    if (!form.title.trim()) {
      setError("Title is required")
      return
    }
    startTransition(async () => {
      try {
        const created = await createCorrectiveAction({
          venueId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          assignee: form.assignee.trim() || undefined,
          dueDate: form.dueDate || undefined,
        })
        onCreated(created)
        setForm({ title: "", description: "", priority: "Medium", assignee: "", dueDate: "" })
        setError(null)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create action")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus className="size-4" />
            New action
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create corrective action</DialogTitle>
          <DialogDescription>Track a fix or follow-up that needs resolving.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Replace faulty fridge seal"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="a-desc">Description</Label>
            <Textarea
              id="a-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => update("priority", v ?? "Medium")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-date">Due date</Label>
              <Input
                id="a-date"
                type="date"
                value={form.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="a-assignee">Assignee</Label>
            <Input
              id="a-assignee"
              value={form.assignee}
              onChange={(e) => update("assignee", e.target.value)}
              placeholder="Who owns this fix?"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
