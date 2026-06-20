"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createTakings, deleteTakings } from "@/app/actions/takings"
import type { DbTakings } from "@/lib/db/schema"

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
})

function total(t: DbTakings) {
  return (t.wetPence + t.foodPence + t.eventsPence + t.retailPence) / 100
}

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

const blank = {
  dateISO: new Date().toISOString().slice(0, 10),
  wet: "",
  food: "",
  events: "",
  retail: "",
}

interface Props {
  venueId: number
  initialTakings: DbTakings[]
}

export function TakingsLog({ venueId, initialTakings }: Props) {
  const [rows, setRows] = useState<DbTakings[]>(initialTakings)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function toPence(v: string) {
    const n = Number.parseFloat(v)
    return Number.isNaN(n) || n < 0 ? 0 : Math.round(n * 100)
  }

  async function handleAdd() {
    if (!form.dateISO) return setError("Choose a date.")
    const wetPence = toPence(form.wet)
    const foodPence = toPence(form.food)
    const eventsPence = toPence(form.events)
    const retailPence = toPence(form.retail)
    if (wetPence + foodPence + eventsPence + retailPence === 0) {
      return setError("Enter at least one sales figure.")
    }
    setError(null)
    setSaving(true)
    try {
      const created = await createTakings({
        venueId,
        dateISO: form.dateISO,
        wetPence,
        foodPence,
        eventsPence,
        retailPence,
      })
      setRows((prev) =>
        [created, ...prev.filter((r) => r.dateISO !== created.dateISO)].sort((a, b) =>
          a.dateISO < b.dateISO ? 1 : -1,
        ),
      )
      setForm(blank)
      setOpen(false)
    } catch {
      setError("Failed to save takings.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this day's takings?")) return
    await deleteTakings(id)
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <>
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Daily takings</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Recorded sales by day</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Log takings
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No takings recorded yet. Log your first day above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Wet</TableHead>
                  <TableHead className="text-right">Food</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">
                      {fmtDate(r.dateISO)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {gbp.format(r.wetPence / 100)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {gbp.format(r.foodPence / 100)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {gbp.format(r.eventsPence / 100)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {gbp.format(total(r))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Log daily takings</DialogTitle>
            <DialogDescription>
              Enter sales for a day. Re-saving a date overwrites it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tk-date">Date</Label>
              <Input
                id="tk-date"
                type="date"
                value={form.dateISO}
                onChange={(e) => setForm((f) => ({ ...f, dateISO: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tk-wet">Wet / drinks (£)</Label>
                <Input
                  id="tk-wet"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.wet}
                  onChange={(e) => setForm((f) => ({ ...f, wet: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tk-food">Food (£)</Label>
                <Input
                  id="tk-food"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.food}
                  onChange={(e) => setForm((f) => ({ ...f, food: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tk-events">Events (£)</Label>
                <Input
                  id="tk-events"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.events}
                  onChange={(e) => setForm((f) => ({ ...f, events: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tk-retail">Retail (£)</Label>
                <Input
                  id="tk-retail"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.retail}
                  onChange={(e) => setForm((f) => ({ ...f, retail: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? "Saving..." : "Save takings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
