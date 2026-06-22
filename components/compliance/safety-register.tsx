"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { RowActions } from "@/components/compliance/row-actions"
import { createSafetyRecord, deleteSafetyRecord, logSafetyRecord } from "@/app/actions/safety"
import type { DbSafetyRecord } from "@/lib/db/schema"

const frequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "6-monthly", "Annual"]
const statuses = ["Due", "Complete", "Overdue", "Valid"]

function RecordDialog({ venueId, module }: { venueId: number; module: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [reference, setReference] = useState("")
  const [owner, setOwner] = useState("")
  const [frequency, setFrequency] = useState("Annual")
  const [nextDue, setNextDue] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("A name is required.")
    setSaving(true)
    setError(null)
    try {
      await createSafetyRecord({ venueId, module, name, reference, owner, frequency, nextDue, notes })
      setName("")
      setReference("")
      setOwner("")
      setFrequency("Annual")
      setNextDue("")
      setNotes("")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-1.5">
            <Plus className="size-4" /> Add record
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {module.toLowerCase()} record</DialogTitle>
          <DialogDescription>Track a recurring obligation with an owner and due date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="rec-name">Record</Label>
            <Input id="rec-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fire alarm service" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rec-ref">Reference</Label>
              <Input id="rec-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="BS 5839" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rec-owner">Owner</Label>
              <Input id="rec-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Tom B." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rec-freq">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v ?? "Annual")}>
                <SelectTrigger id="rec-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rec-due">Next due</Label>
              <Input id="rec-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rec-notes">Notes</Label>
            <Textarea id="rec-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SafetyRegister({
  venueId,
  module,
  description,
  records,
}: {
  venueId: number
  module: string
  description: string
  records: DbSafetyRecord[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function handleLog(id: number) {
    setBusyId(id)
    try {
      await logSafetyRecord(id)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold">{module}</h3>
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
        <RecordDialog venueId={venueId} module={module} />
      </div>
      <CardContent className="px-0">
        {records.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No {module.toLowerCase()} records yet. Use &ldquo;Add record&rdquo; to create your first one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.reference ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.owner ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.frequency}</TableCell>
                  <TableCell className="text-muted-foreground">{r.nextDue ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={busyId === r.id || r.status === "Complete"}
                        onClick={() => handleLog(r.id)}
                      >
                        <CheckCircle2 className="size-4" />
                        {r.status === "Complete" ? "Done" : "Log done"}
                      </Button>
                      <RowActions
                        deleteLabel={`Delete ${r.name}`}
                        deleteAction={async () => {
                          await deleteSafetyRecord(r.id)
                          router.refresh()
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
