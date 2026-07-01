"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Eraser,
  Loader2,
  MessagesSquare,
  PenLine,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import {
  addMeetingAction,
  createMeeting,
  deleteMeeting,
  signMeeting,
  updateMeetingActionStatus,
  type MeetingWithActions,
} from "@/app/actions/oversight"
import type { DbMeetingAction, DbStaffMember } from "@/lib/db/schema"

function statusTone(status: string) {
  switch (status) {
    case "Completed":
      return "bg-chart-2/15 text-chart-2"
    case "Held":
      return "bg-chart-3/15 text-chart-3"
    case "Actions Overdue":
    case "Review Overdue":
    case "Overdue":
      return "bg-destructive/12 text-destructive"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function MeetingsPanel({
  venueId,
  initialMeetings,
  staff,
}: {
  venueId: number
  initialMeetings: MeetingWithActions[]
  staff: DbStaffMember[]
}) {
  const [meetings, setMeetings] = useState<MeetingWithActions[]>(initialMeetings)

  const allActions = useMemo(
    () =>
      meetings.flatMap((m) =>
        m.actions.map((a) => ({ action: a, meetingTitle: m.title })),
      ),
    [meetings],
  )

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const held = meetings.filter((m) => m.status !== "Pending").length
    const completedActions = allActions.filter((a) => a.action.status === "Completed").length
    const overdueActions = allActions.filter(
      (a) => a.action.status !== "Completed" && a.action.dueDate && a.action.dueDate < today,
    ).length
    return { held, completedActions, overdueActions }
  }, [meetings, allActions])

  function updateMeeting(updated: MeetingWithActions) {
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  function setActionStatus(actionId: number, status: string) {
    setMeetings((prev) =>
      prev.map((m) => ({
        ...m,
        actions: m.actions.map((a) =>
          a.id === actionId ? { ...a, status, completedAt: status === "Completed" ? new Date() : null } : a,
        ),
      })),
    )
    updateMeetingActionStatus(actionId, status)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Meetings held" value={stats.held} icon={MessagesSquare} tone="text-chart-3" />
        <StatTile label="Completed actions" value={stats.completedActions} icon={CheckCircle2} tone="text-chart-2" />
        <StatTile label="Overdue actions" value={stats.overdueActions} icon={Clock} tone="text-destructive" />
      </div>

      <div className="flex justify-end">
        <CreateMeetingDialog
          venueId={venueId}
          staff={staff}
          onCreated={(m) => setMeetings((prev) => [m, ...prev])}
        />
      </div>

      <Tabs defaultValue="meetings">
        <TabsList>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="actions">
            Actions
            {allActions.length > 0 && (
              <Badge variant="outline" className="ml-2 border-transparent bg-muted text-muted-foreground">
                {allActions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meetings" className="mt-5">
          {meetings.length === 0 ? (
            <EmptyRow
              icon={CalendarClock}
              title="No meetings yet"
              description="Schedule a business meeting with your operator, then capture a signature review of the notes."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {meetings.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  onChange={updateMeeting}
                  onDelete={(id) => setMeetings((prev) => prev.filter((x) => x.id !== id))}
                  onActionStatus={setActionStatus}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="mt-5">
          {allActions.length === 0 ? (
            <EmptyRow
              icon={CheckCircle2}
              title="No meeting actions"
              description="Actions agreed in meetings appear here so you can track them to completion across your estate."
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {allActions.map(({ action, meetingTitle }) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  meetingTitle={meetingTitle}
                  onStatus={setActionStatus}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: typeof MessagesSquare
  tone: string
}) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <div className={cn("flex size-10 items-center justify-center rounded-md bg-muted", tone)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}

function EmptyRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof MessagesSquare
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

function MeetingCard({
  meeting,
  onChange,
  onDelete,
  onActionStatus,
}: {
  meeting: MeetingWithActions
  onChange: (m: MeetingWithActions) => void
  onDelete: (id: number) => void
  onActionStatus: (actionId: number, status: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const doneCount = meeting.actions.filter((a) => a.status === "Completed").length

  function handleDelete() {
    onDelete(meeting.id)
    startTransition(() => {
      deleteMeeting(meeting.id)
    })
  }

  function handleSigned(signatureUrl: string, signedBy: string) {
    onChange({
      ...meeting,
      signatureUrl,
      signedBy,
      signedAt: new Date(),
      reviewedAt: new Date(),
      status: "Held",
    })
  }

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border-transparent", statusTone(meeting.status))}>
              {meeting.status}
            </Badge>
            {meeting.actions.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {doneCount}/{meeting.actions.length} actions done
              </span>
            )}
          </div>
          <p className="mt-2 font-medium text-foreground">{meeting.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {meeting.scheduledDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {fmtDate(meeting.scheduledDate)}
              </span>
            )}
            {meeting.createdBy && (
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" />
                {meeting.createdBy}
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
          aria-label="Delete meeting"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {meeting.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{meeting.notes}</p>}

      {meeting.actions.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 rounded-md border border-border p-3">
          {meeting.actions.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className={cn(a.status === "Completed" && "text-muted-foreground line-through")}>{a.title}</span>
              <Button
                size="sm"
                variant={a.status === "Completed" ? "outline" : "default"}
                className="h-7"
                onClick={() => onActionStatus(a.id, a.status === "Completed" ? "Open" : "Completed")}
              >
                {a.status === "Completed" ? "Reopen" : "Done"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {meeting.signatureUrl ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-chart-2">
            <CheckCircle2 className="size-4" />
            Reviewed &amp; signed{meeting.signedBy ? ` by ${meeting.signedBy}` : ""}
          </span>
        ) : (
          <SignMeetingDialog meetingId={meeting.id} onSigned={handleSigned} />
        )}
        {meeting.signatureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meeting.signatureUrl || "/placeholder.svg"}
            alt="Captured signature"
            className="ml-auto h-10 rounded border border-border bg-card"
          />
        )}
      </div>
    </Card>
  )
}

function ActionRow({
  action,
  meetingTitle,
  onStatus,
}: {
  action: DbMeetingAction
  meetingTitle: string
  onStatus: (actionId: number, status: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = action.status !== "Completed" && !!action.dueDate && action.dueDate < today
  const status = action.status === "Completed" ? "Completed" : overdue ? "Overdue" : "Open"

  return (
    <Card className="flex-row items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", action.status === "Completed" && "text-muted-foreground line-through")}>
          {action.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="truncate">{meetingTitle}</span>
          {action.assignee && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {action.assignee}
            </span>
          )}
          {action.dueDate && <span>Due {fmtDate(action.dueDate)}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className={cn("border-transparent", statusTone(status))}>
          {status}
        </Badge>
        <Button
          size="sm"
          variant={action.status === "Completed" ? "outline" : "default"}
          className="h-7"
          onClick={() => onStatus(action.id, action.status === "Completed" ? "Open" : "Completed")}
        >
          {action.status === "Completed" ? "Reopen" : "Complete"}
        </Button>
      </div>
    </Card>
  )
}

type DraftAction = { title: string; assignee: string; dueDate: string }

const NO_ASSIGNEE = "none"

function CreateMeetingDialog({
  venueId,
  staff,
  onCreated,
}: {
  venueId: number
  staff: DbStaffMember[]
  onCreated: (m: MeetingWithActions) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [createdBy, setCreatedBy] = useState("")
  const [notes, setNotes] = useState("")
  const [assignedStaffId, setAssignedStaffId] = useState<string>(NO_ASSIGNEE)
  const [actions, setActions] = useState<DraftAction[]>([{ title: "", assignee: "", dueDate: "" }])

  // Only staff members with a linked login can be co-assigned (so it can pop up
  // on their calendar + notifications).
  const assignable = useMemo(() => staff.filter((s) => s.linkedUserId), [staff])

  function reset() {
    setTitle("")
    setScheduledDate("")
    setCreatedBy("")
    setNotes("")
    setAssignedStaffId(NO_ASSIGNEE)
    setActions([{ title: "", assignee: "", dueDate: "" }])
    setError(null)
  }

  function setAction(idx: number, patch: Partial<DraftAction>) {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }

  function submit() {
    if (!title.trim()) {
      setError("Meeting title is required")
      return
    }
    startTransition(async () => {
      try {
        const cleanActions = actions
          .filter((a) => a.title.trim())
          .map((a) => ({ title: a.title.trim(), assignee: a.assignee.trim() || undefined, dueDate: a.dueDate || undefined }))
        const created = await createMeeting({
          venueId,
          title: title.trim(),
          scheduledDate: scheduledDate || undefined,
          createdBy: createdBy.trim() || undefined,
          notes: notes.trim() || undefined,
          actions: cleanActions,
        })
        onCreated({
          ...created,
          actions: cleanActions.map((a, idx) => ({
            id: -1 - idx,
            userId: created.userId,
            venueId,
            meetingId: created.id,
            title: a.title,
            assignee: a.assignee ?? null,
            dueDate: a.dueDate ?? null,
            status: "Open",
            completedAt: null,
            createdAt: new Date(),
          })),
        })
        reset()
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create meeting")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Schedule meeting
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule meeting</DialogTitle>
          <DialogDescription>Prepare notes and agree follow-up actions with your operator.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-title">Title</Label>
            <Input
              id="m-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly BDM review"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-date">Scheduled date</Label>
              <Input id="m-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-by">Created by</Label>
              <Input
                id="m-by"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="e.g. Matt"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-notes">Meeting notes</Label>
            <Textarea
              id="m-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda, discussion points and decisions to share."
              rows={4}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Follow-up actions</Label>
            <div className="flex flex-col gap-2">
              {actions.map((a, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={a.title}
                    onChange={(e) => setAction(idx, { title: e.target.value })}
                    placeholder="Action to complete"
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    value={a.dueDate}
                    onChange={(e) => setAction(idx, { dueDate: e.target.value })}
                    className="w-40"
                    aria-label="Due date"
                  />
                  {actions.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground"
                      onClick={() => setActions((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove action"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => setActions((prev) => [...prev, { title: "", assignee: "", dueDate: "" }])}
            >
              <Plus className="size-4" />
              Add action
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Schedule meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SignMeetingDialog({
  meetingId,
  onSigned,
}: {
  meetingId: number
  onSigned: (signatureUrl: string, signedBy: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [signedBy, setSignedBy] = useState("")
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = pos(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.strokeStyle = "#0f172a"
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInk.current = true
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
  }

  function submit() {
    if (!signedBy.trim()) {
      setError("Enter the name of the person reviewing")
      return
    }
    if (!hasInk.current) {
      setError("Please capture a signature")
      return
    }
    const dataUrl = canvasRef.current!.toDataURL("image/png")
    startTransition(async () => {
      try {
        await signMeeting({ meetingId, signatureUrl: dataUrl, signedBy: signedBy.trim() })
        onSigned(dataUrl, signedBy.trim())
        setOpen(false)
        setSignedBy("")
        clear()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save signature")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        setError(null)
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <PenLine className="size-4" />
            Capture signature review
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signature review</DialogTitle>
          <DialogDescription>
            Confirm the operator has read the meeting notes by capturing their signature.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="s-name">Reviewed by</Label>
            <Input
              id="s-name"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Signature</Label>
            <div className="rounded-md border border-border bg-card">
              <canvas
                ref={canvasRef}
                width={440}
                height={180}
                className="h-[180px] w-full touch-none rounded-md"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
              />
            </div>
            <Button size="sm" variant="ghost" className="self-start text-muted-foreground" onClick={clear}>
              <Eraser className="size-4" />
              Clear
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
