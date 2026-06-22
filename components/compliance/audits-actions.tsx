"use client"

import { useState, useTransition } from "react"
import { Plus, ClipboardCheck, Wrench, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { RowActions } from "@/components/compliance/row-actions"
import {
  createAudit,
  completeAudit,
  deleteAudit,
  createCorrectiveAction,
  updateCorrectiveActionStatus,
  deleteCorrectiveAction,
} from "@/app/actions/safety"

type Audit = {
  id: number
  title: string
  module: string
  auditor: string | null
  auditDate: string | null
  score: number | null
  maxScore: number
  findings: string | null
  status: string
}

type Action = {
  id: number
  title: string
  description: string | null
  priority: string
  assignee: string | null
  dueDate: string | null
  status: string
  sourceAuditId: number | null
}

const AUDIT_MODULES = ["H&S", "Fire Safety", "Food Safety", "Licensing", "Property"]
const PRIORITIES = ["Low", "Medium", "High"]

export function AuditsActions({
  venueId,
  audits,
  actions,
}: {
  venueId: number
  audits: Audit[]
  actions: Action[]
}) {
  const [auditOpen, setAuditOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [sourceAuditId, setSourceAuditId] = useState<number | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleCreateAudit(formData: FormData) {
    startTransition(async () => {
      await createAudit({
        venueId,
        title: String(formData.get("title") || ""),
        module: String(formData.get("module") || "H&S"),
        auditor: String(formData.get("auditor") || ""),
        auditDate: String(formData.get("auditDate") || ""),
      })
      setAuditOpen(false)
    })
  }

  function handleCreateAction(formData: FormData) {
    startTransition(async () => {
      await createCorrectiveAction({
        venueId,
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || ""),
        priority: String(formData.get("priority") || "Medium"),
        assignee: String(formData.get("assignee") || ""),
        dueDate: String(formData.get("dueDate") || ""),
        sourceAuditId,
      })
      setActionOpen(false)
      setSourceAuditId(undefined)
    })
  }

  const openActions = actions.filter((a) => a.status !== "Resolved")
  const resolvedActions = actions.filter((a) => a.status === "Resolved")

  return (
    <div className="flex flex-col gap-6">
      {/* Audits */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold">Audits</h2>
            <p className="text-sm text-muted-foreground">
              Schedule and score inspections across safety modules.
            </p>
          </div>
          <Button onClick={() => setAuditOpen(true)}>
            <Plus className="size-4" />
            New audit
          </Button>
        </div>

        {audits.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <ClipboardCheck className="size-8 text-muted-foreground" />
            <p className="font-medium">No audits yet</p>
            <p className="text-sm text-muted-foreground">Schedule your first inspection.</p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {audits.map((a) => (
              <AuditCard
                key={a.id}
                audit={a}
                onRaiseAction={(id) => {
                  setSourceAuditId(id)
                  setActionOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Corrective actions */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold">Corrective actions</h2>
            <p className="text-sm text-muted-foreground">
              Track and close out issues raised from audits and checks.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSourceAuditId(undefined)
              setActionOpen(true)
            }}
          >
            <Plus className="size-4" />
            New action
          </Button>
        </div>

        {actions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Wrench className="size-8 text-muted-foreground" />
            <p className="font-medium">No corrective actions</p>
            <p className="text-sm text-muted-foreground">
              Raise an action from an audit or create one directly.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {openActions.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
            {resolvedActions.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </div>
        )}
      </div>

      {/* New audit dialog */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>New audit</DialogTitle>
          <form action={handleCreateAudit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-title">Title</Label>
              <Input id="aud-title" name="title" placeholder="Monthly H&S inspection" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Module</Label>
                <Select name="module" defaultValue="H&S">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIT_MODULES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="aud-date">Date</Label>
                <Input id="aud-date" name="auditDate" type="date" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-auditor">Auditor</Label>
              <Input id="aud-auditor" name="auditor" placeholder="Name" />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose
                render={(props) => (
                  <Button {...props} type="button" variant="outline">
                    Cancel
                  </Button>
                )}
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create audit"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New action dialog */}
      <Dialog
        open={actionOpen}
        onOpenChange={(o) => {
          setActionOpen(o)
          if (!o) setSourceAuditId(undefined)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>New corrective action</DialogTitle>
          {sourceAuditId ? (
            <p className="mt-1 text-sm text-muted-foreground">Linked to an audit finding.</p>
          ) : null}
          <form action={handleCreateAction} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-title">Title</Label>
              <Input id="act-title" name="title" placeholder="Replace cracked floor tile" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-desc">Description</Label>
              <Textarea id="act-desc" name="description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Priority</Label>
                <Select name="priority" defaultValue="Medium">
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="act-due">Due date</Label>
                <Input id="act-due" name="dueDate" type="date" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-assignee">Assignee</Label>
              <Input id="act-assignee" name="assignee" placeholder="Name" />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose
                render={(props) => (
                  <Button {...props} type="button" variant="outline">
                    Cancel
                  </Button>
                )}
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create action"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AuditCard({
  audit,
  onRaiseAction,
}: {
  audit: Audit
  onRaiseAction: (id: number) => void
}) {
  const [scoreOpen, setScoreOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pct = audit.score != null ? Math.round((audit.score / audit.maxScore) * 100) : null

  function handleComplete(formData: FormData) {
    startTransition(async () => {
      await completeAudit({
        id: audit.id,
        score: Number(formData.get("score") || 0),
        maxScore: Number(formData.get("maxScore") || 100),
        findings: String(formData.get("findings") || ""),
      })
      setScoreOpen(false)
    })
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{audit.title}</h3>
            <StatusBadge status={audit.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{audit.module}</span>
            {audit.auditor ? <span>{audit.auditor}</span> : null}
            {audit.auditDate ? <span>{audit.auditDate}</span> : null}
          </div>
        </div>
        <RowActions deleteAction={() => deleteAudit(audit.id)} deleteLabel="Delete audit" />
      </div>

      {pct != null ? (
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-2xl font-bold">{pct}%</span>
          <span className="text-sm text-muted-foreground">
            {audit.score}/{audit.maxScore}
          </span>
        </div>
      ) : null}

      {audit.findings ? (
        <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{audit.findings}</p>
      ) : null}

      <div className="flex gap-2">
        {audit.status !== "Complete" ? (
          <Button size="sm" onClick={() => setScoreOpen(true)}>
            Complete &amp; score
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => onRaiseAction(audit.id)}>
          <Wrench className="size-4" />
          Raise action
        </Button>
      </div>

      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Complete audit</DialogTitle>
          <form action={handleComplete} className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`score-${audit.id}`}>Score</Label>
                <Input
                  id={`score-${audit.id}`}
                  name="score"
                  type="number"
                  min={0}
                  defaultValue={audit.score ?? ""}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`max-${audit.id}`}>Out of</Label>
                <Input
                  id={`max-${audit.id}`}
                  name="maxScore"
                  type="number"
                  min={1}
                  defaultValue={audit.maxScore}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`find-${audit.id}`}>Findings</Label>
              <Textarea id={`find-${audit.id}`} name="findings" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose
                render={(props) => (
                  <Button {...props} type="button" variant="outline">
                    Cancel
                  </Button>
                )}
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save result"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ActionRow({ action }: { action: Action }) {
  const [isPending, startTransition] = useTransition()
  const resolved = action.status === "Resolved"

  function setStatus(status: string) {
    startTransition(async () => {
      await updateCorrectiveActionStatus(action.id, status)
    })
  }

  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${resolved ? "text-muted-foreground line-through" : ""}`}>
            {action.title}
          </span>
          <StatusBadge status={action.status} />
          {action.sourceAuditId ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              From audit
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{action.priority} priority</span>
          {action.assignee ? <span>{action.assignee}</span> : null}
          {action.dueDate ? <span>Due {action.dueDate}</span> : null}
        </div>
        {action.description ? (
          <p className="text-sm text-muted-foreground">{action.description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!resolved ? (
          <>
            {action.status === "Open" ? (
              <Button size="sm" variant="outline" onClick={() => setStatus("In progress")} disabled={isPending}>
                Start
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setStatus("Resolved")} disabled={isPending}>
              <CheckCircle2 className="size-4" />
              Resolve
            </Button>
          </>
        ) : (
          <RowActions
            deleteAction={() => deleteCorrectiveAction(action.id)}
            deleteLabel="Delete action"
          />
        )}
      </div>
    </Card>
  )
}
