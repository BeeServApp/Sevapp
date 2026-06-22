"use client"

import { useState, useTransition } from "react"
import { Plus, ClipboardCheck, Trash2, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
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
import { createChecklist, saveChecklistRun, deleteChecklist } from "@/app/actions/safety"

type ChecklistWithRun = {
  id: number
  title: string
  module: string
  timeOfDay: string | null
  frequency: string
  active: boolean
  parsedItems: string[]
  todayRun: {
    id: number
    completedItems: string | null
    doneCount: number
    totalItems: number
    status: string
    completedBy: string | null
    notes: string | null
  } | null
}

const MODULES = ["Opening", "Closing", "Kitchen", "Cellar", "Front of House", "Weekly"]

export function DailyChecklists({
  venueId,
  checklists,
}: {
  venueId: number
  checklists: ChecklistWithRun[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCreate(formData: FormData) {
    const items = String(formData.get("items") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
    startTransition(async () => {
      await createChecklist({
        venueId,
        title: String(formData.get("title") || ""),
        module: String(formData.get("module") || "Opening"),
        timeOfDay: String(formData.get("timeOfDay") || ""),
        frequency: String(formData.get("frequency") || "Daily"),
        items,
      })
      setCreateOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Daily checklists</h2>
          <p className="text-sm text-muted-foreground">
            Recurring opening, closing and area checks completed by staff each day.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New checklist
        </Button>
      </div>

      {checklists.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground" />
          <p className="font-medium">No checklists yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first opening or closing checklist for staff to complete.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {checklists.map((c) => (
            <ChecklistCard key={c.id} venueId={venueId} checklist={c} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>New checklist</DialogTitle>
          <form action={handleCreate} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-title">Title</Label>
              <Input id="cl-title" name="title" placeholder="Morning opening checks" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Area</Label>
                <Select name="module" defaultValue="Opening">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Frequency</Label>
                <Select name="frequency" defaultValue="Daily">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Daily", "Weekly", "Monthly"].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-time">Time of day (optional)</Label>
              <Input id="cl-time" name="timeOfDay" placeholder="e.g. Before 11:00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-items">Checklist items (one per line)</Label>
              <Textarea
                id="cl-items"
                name="items"
                rows={5}
                placeholder={"Check fire exits are clear\nTest till float\nRecord fridge temperatures"}
                required
              />
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
                {isPending ? "Creating…" : "Create checklist"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChecklistCard({ venueId, checklist }: { venueId: number; checklist: ChecklistWithRun }) {
  const items = checklist.parsedItems
  const initial: boolean[] = (() => {
    if (checklist.todayRun?.completedItems) {
      try {
        const parsed = JSON.parse(checklist.todayRun.completedItems) as boolean[]
        if (Array.isArray(parsed) && parsed.length === items.length) return parsed
      } catch {
        // fall through
      }
    }
    return items.map(() => false)
  })()

  const [checked, setChecked] = useState<boolean[]>(initial)
  const [completedBy, setCompletedBy] = useState(checklist.todayRun?.completedBy ?? "")
  const [isPending, startTransition] = useTransition()

  const doneCount = checked.filter(Boolean).length
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0
  const allDone = doneCount === items.length && items.length > 0

  function toggle(i: number, value: boolean) {
    setChecked((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  function save() {
    startTransition(async () => {
      await saveChecklistRun({
        venueId,
        checklistId: checklist.id,
        completed: checked,
        total: items.length,
        completedBy,
      })
    })
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{checklist.title}</h3>
            <StatusBadge status={allDone ? "Complete" : "Pending"} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{checklist.module}</span>
            <span>{checklist.frequency}</span>
            {checklist.timeOfDay ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {checklist.timeOfDay}
              </span>
            ) : null}
          </div>
        </div>
        <RowActions
          deleteAction={() => deleteChecklist(checklist.id)}
          deleteLabel="Delete checklist"
        />
      </div>

      <div className="flex items-center gap-3">
        <Progress value={pct} className="h-2 flex-1" />
        <span className="text-xs font-medium text-muted-foreground">
          {doneCount}/{items.length}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <Checkbox
              id={`cl-${checklist.id}-${i}`}
              checked={checked[i]}
              onCheckedChange={(v) => toggle(i, v === true)}
            />
            <label
              htmlFor={`cl-${checklist.id}-${i}`}
              className={`text-sm ${checked[i] ? "text-muted-foreground line-through" : ""}`}
            >
              {item}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-end gap-2 border-t border-border pt-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`cl-by-${checklist.id}`} className="text-xs">
            Completed by
          </Label>
          <Input
            id={`cl-by-${checklist.id}`}
            value={completedBy}
            onChange={(e) => setCompletedBy(e.target.value)}
            placeholder="Staff name"
            className="h-9"
          />
        </div>
        <Button onClick={save} disabled={isPending} size="sm">
          {isPending ? "Saving…" : "Save progress"}
        </Button>
      </div>
    </Card>
  )
}
