"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarOff, Plus } from "lucide-react"
import { createMyLeaveRequest } from "@/app/actions/staff"
import { PortalHeader } from "@/components/portal/portal-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/status-badge"
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
import { cn } from "@/lib/utils"
import type { DbLeaveRequest } from "@/lib/db/schema"

const LEAVE_TYPES = ["Annual", "Sick", "Unpaid", "Compassionate"] as const

function fmt(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Inclusive whole-day count between two ISO dates (min 1). */
function dayCount(startISO: string, endISO: string): number {
  const a = new Date(`${startISO}T00:00:00`).getTime()
  const b = new Date(`${endISO}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

export function LeaveView({ initialLeave }: { initialLeave: DbLeaveRequest[] }) {
  const router = useRouter()
  const [requests, setRequests] = useState<DbLeaveRequest[]>(initialLeave)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<string>("Annual")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const days = useMemo(() => (start && end ? dayCount(start, end) : 0), [start, end])

  function resetForm() {
    setType("Annual")
    setStart("")
    setEnd("")
    setError(null)
  }

  async function handleSubmit() {
    if (!start) return setError("Choose a start date.")
    if (!end) return setError("Choose an end date.")
    if (days < 1) return setError("The end date must be on or after the start date.")
    setError(null)
    setSaving(true)
    try {
      const dates = start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
      const created = await createMyLeaveRequest({ type, dates, days })
      setRequests((prev) => [created, ...prev])
      setOpen(false)
      resetForm()
      startTransition(() => router.refresh())
    } catch {
      setError("Could not submit your request. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const pending = requests.filter((r) => r.status === "Pending").length

  return (
    <div className="flex flex-col gap-4">
      <PortalHeader
        title="Leave"
        description={pending > 0 ? `${pending} request${pending === 1 ? "" : "s"} awaiting approval` : undefined}
        action={
          <button
            type="button"
            aria-label="Request leave"
            onClick={() => setOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="size-4" />
          </button>
        }
      />

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="mb-1 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarOff className="size-8" />
            </span>
            <h2 className="text-pretty text-lg font-semibold text-foreground">No leave requests yet</h2>
            <p className="max-w-xs text-pretty text-sm text-muted-foreground">
              Request time off and your manager will approve or decline it. Approved leave shows on the rota.
            </p>
            <Button size="lg" className="mt-2" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Request leave
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col">
            {requests.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center justify-between gap-3 py-3",
                  i < requests.length - 1 && "border-b border-border",
                )}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{r.dates}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.type} · {r.days} day{r.days === 1 ? "" : "s"}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>Submit time off for your manager to review.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="leave-type">Leave type</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? type)}>
                <SelectTrigger id="leave-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="leave-start">From</Label>
                <Input
                  id="leave-start"
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value)
                    if (end && e.target.value && end < e.target.value) setEnd(e.target.value)
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="leave-end">To</Label>
                <Input
                  id="leave-end"
                  type="date"
                  min={start || undefined}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            {days > 0 && (
              <p className="text-sm text-muted-foreground">
                {days} day{days === 1 ? "" : "s"} of {type.toLowerCase()} leave.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
