"use client"

import type React from "react"
import { useState } from "react"
import { Plus, Trash2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  createAssetMaintenance,
  deleteAssetMaintenance,
  updateAssetMaintenanceStatus,
} from "@/app/actions/assets"
import type {
  MaintenancePriority,
  MaintenanceRecord,
  MaintenanceStatus,
  ViewAsset,
} from "@/lib/asset-types"
import { cn } from "@/lib/utils"

const priorities: MaintenancePriority[] = ["Low", "Medium", "High"]
const statuses: MaintenanceStatus[] = ["Open", "In progress", "Resolved"]

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })

const priorityClasses: Record<MaintenancePriority, string> = {
  Low: "border-transparent bg-muted text-muted-foreground",
  Medium: "border-transparent bg-chart-3/15 text-chart-3",
  High: "border-transparent bg-destructive/12 text-destructive",
}

const statusClasses: Record<MaintenanceStatus, string> = {
  Open: "border-transparent bg-chart-4/20 text-[oklch(0.45_0.11_70)]",
  "In progress": "border-transparent bg-chart-1/15 text-chart-1",
  Resolved: "border-transparent bg-chart-2/15 text-chart-2",
}

function todayInputDate() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function toDisplayDate(input: string): string {
  if (!input) return ""
  return new Date(input).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

interface MaintenanceLogDialogProps {
  asset: ViewAsset
  venueId: number
  records: MaintenanceRecord[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (records: MaintenanceRecord[]) => void
}

export function MaintenanceLogDialog({
  asset,
  venueId,
  records,
  open,
  onOpenChange,
  onChange,
}: MaintenanceLogDialogProps) {
  const [issue, setIssue] = useState("")
  const [priority, setPriority] = useState<MaintenancePriority>("Medium")
  const [status, setStatus] = useState<MaintenanceStatus>("Open")
  const [assignee, setAssignee] = useState("")
  const [cost, setCost] = useState("")
  const [loggedDate, setLoggedDate] = useState(todayInputDate())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  function resetForm() {
    setIssue("")
    setPriority("Medium")
    setStatus("Open")
    setAssignee("")
    setCost("")
    setLoggedDate(todayInputDate())
    setError(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!issue.trim()) return setError("Please describe the maintenance issue.")
    const costNum = cost ? Number.parseFloat(cost) : 0
    if (Number.isNaN(costNum) || costNum < 0) return setError("Please enter a valid cost.")

    setError(null)
    setSaving(true)
    try {
      const created = await createAssetMaintenance({
        venueId,
        assetId: asset.dbId,
        assetName: asset.name,
        issue: issue.trim(),
        priority,
        status,
        assignee: assignee.trim(),
        costPence: Math.round(costNum * 100),
        loggedDate: toDisplayDate(loggedDate),
      })
      const record: MaintenanceRecord = {
        id: created.id,
        assetId: asset.dbId,
        issue: created.issue ?? issue.trim(),
        priority,
        status,
        assignee: created.assignee ?? "",
        cost: (created.costPence ?? 0) / 100,
        loggedDate: created.loggedDate ?? toDisplayDate(loggedDate),
      }
      onChange([record, ...records])
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add record.")
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(record: MaintenanceRecord, next: MaintenanceStatus) {
    setBusyId(record.id)
    try {
      await updateAssetMaintenanceStatus(record.id, next)
      onChange(records.map((r) => (r.id === record.id ? { ...r, status: next } : r)))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(record: MaintenanceRecord) {
    setBusyId(record.id)
    try {
      await deleteAssetMaintenance(record.id)
      onChange(records.filter((r) => r.id !== record.id))
    } finally {
      setBusyId(null)
    }
  }

  const totalCost = records.reduce((sum, r) => sum + r.cost, 0)
  const openCount = records.filter((r) => r.status !== "Resolved").length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            Maintenance log
          </DialogTitle>
          <DialogDescription>
            {asset.id} – {asset.name}
            {records.length > 0 && (
              <>
                {" · "}
                {records.length} record{records.length === 1 ? "" : "s"}
                {openCount > 0 && ` · ${openCount} open`}
                {totalCost > 0 && ` · ${gbp.format(totalCost)} total`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Existing records */}
        {records.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No maintenance recorded yet. Add the first record below.
          </p>
        ) : (
          <ul className="grid gap-2">
            {records.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.issue}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.loggedDate || "No date"}
                      {r.assignee && ` · ${r.assignee}`}
                      {r.cost > 0 && ` · ${gbp.format(r.cost)}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(r)}
                    disabled={busyId === r.id}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete record</span>
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn("font-medium", priorityClasses[r.priority])}>
                    {r.priority}
                  </Badge>
                  <Badge variant="outline" className={cn("font-medium", statusClasses[r.status])}>
                    {r.status}
                  </Badge>
                  <Select
                    value={r.status}
                    onValueChange={(v) => handleStatusChange(r, v as MaintenanceStatus)}
                  >
                    <SelectTrigger size="sm" className="ml-auto w-auto gap-1 text-xs" disabled={busyId === r.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Add record form */}
        <form onSubmit={handleAdd} className="grid gap-4 border-t border-border pt-4">
          <div className="grid gap-2">
            <Label htmlFor="m-issue">Issue / work carried out</Label>
            <Textarea
              id="m-issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="e.g. Replaced cellar cooling fan, serviced compressor"
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="m-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as MaintenancePriority)}>
                <SelectTrigger id="m-priority">
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
            <div className="grid gap-2">
              <Label htmlFor="m-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MaintenanceStatus)}>
                <SelectTrigger id="m-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-1">
              <Label htmlFor="m-cost">Cost (£)</Label>
              <Input
                id="m-cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <Label htmlFor="m-date">Date</Label>
              <Input
                id="m-date"
                type="date"
                value={loggedDate}
                onChange={(e) => setLoggedDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <Label htmlFor="m-assignee">Contractor / staff</Label>
              <Input
                id="m-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g. CoolTech Ltd"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" className="gap-1.5" disabled={saving}>
              <Plus className="size-4" />
              {saving ? "Adding..." : "Add record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
