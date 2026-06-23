"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2, Coins, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { addTip, deleteTip } from "@/app/actions/scheduling"
import { formatMoney, dayLabelOf, weekRangeLabel } from "@/lib/rota"
import type { DbStaffMember, DbRotaShift, DbTipEntry } from "@/lib/db/schema"

interface Props {
  venueId: number
  weekStart: string
  staff: DbStaffMember[]
  shifts: DbRotaShift[]
  initialTips: DbTipEntry[]
}

export function TipsTab({ venueId, weekStart, staff, shifts, initialTips }: Props) {
  const [tips, setTips] = useState<DbTipEntry[]>(initialTips)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    dateISO: weekStart,
    pooled: true,
    staffMemberId: "",
    amount: "",
    method: "card" as "card" | "cash",
  })

  const nameById = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  // Distribute pooled tips equally among staff who have a shift that day.
  const perStaffTotals = useMemo(() => {
    const totals = new Map<number, number>()
    for (const s of staff) totals.set(s.id, 0)
    for (const t of tips) {
      if (!t.pooled && t.staffMemberId) {
        totals.set(t.staffMemberId, (totals.get(t.staffMemberId) ?? 0) + t.amountPence)
      } else if (t.pooled) {
        const day = dayLabelOf(t.dateISO)
        const workers = Array.from(new Set(shifts.filter((sh) => sh.day === day && sh.staffMemberId > 0).map((sh) => sh.staffMemberId)))
        if (workers.length > 0) {
          const share = t.amountPence / workers.length
          for (const w of workers) totals.set(w, (totals.get(w) ?? 0) + share)
        }
      }
    }
    return totals
  }, [tips, shifts, staff])

  const totalTips = useMemo(() => tips.reduce((s, t) => s + t.amountPence, 0), [tips])
  const pooledTotal = useMemo(() => tips.filter((t) => t.pooled).reduce((s, t) => s + t.amountPence, 0), [tips])

  async function handleAdd() {
    const amountPence = Math.round(Number.parseFloat(form.amount || "0") * 100)
    if (!amountPence || amountPence <= 0) return
    setSaving(true)
    try {
      const created = await addTip({
        venueId,
        dateISO: form.dateISO,
        pooled: form.pooled,
        staffMemberId: form.pooled ? null : Number(form.staffMemberId) || null,
        amountPence,
        method: form.method,
        note: null,
      })
      setTips((prev) => [created, ...prev])
      setOpen(false)
      setForm({ dateISO: weekStart, pooled: true, staffMemberId: "", amount: "", method: "card" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteTip(id)
    setTips((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-4" /> Total tips (week)
            </span>
            <span className="text-2xl font-semibold tabular-nums">{formatMoney(totalTips)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-4" /> Pooled
            </span>
            <span className="text-2xl font-semibold tabular-nums">{formatMoney(pooledTotal)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-center p-4">
            <Button onClick={() => setOpen(true)} disabled={staff.length === 0}>
              <Plus className="size-4" /> Record tips
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tip distribution — {weekRangeLabel(weekStart)}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Pooled tips are split equally between team members scheduled that day. Commission rate is shown per person.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team member</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead className="text-right">Tips (week)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    {s.commissionPct > 0 ? (
                      <Badge variant="outline">{s.commissionPct}%</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(Math.round(perStaffTotals.get(s.id) ?? 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tip entries</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {tips.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No tips recorded for this week yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...tips]
                  .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
                  .map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="tabular-nums text-muted-foreground">{t.dateISO}</TableCell>
                      <TableCell>
                        {t.pooled ? (
                          <Badge variant="outline">Pooled</Badge>
                        ) : (
                          <span className="text-sm">{nameById.get(t.staffMemberId ?? -1) ?? "Individual"}</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{t.method}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(t.amountPence)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="size-3.5" />
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
            <DialogTitle>Record tips</DialogTitle>
            <DialogDescription>Log cash or card tips for a date, pooled or to one person.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tip-date">Date</Label>
              <Input
                id="tip-date"
                type="date"
                value={form.dateISO}
                onChange={(e) => setForm((f) => ({ ...f, dateISO: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <Label htmlFor="tip-pooled" className="cursor-pointer">Pool across team</Label>
                <p className="text-xs text-muted-foreground">Split between staff scheduled that day</p>
              </div>
              <Switch
                id="tip-pooled"
                checked={form.pooled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, pooled: v }))}
              />
            </div>
            {!form.pooled && (
              <div className="grid gap-2">
                <Label>Team member</Label>
                <Select
                  value={form.staffMemberId}
                  onValueChange={(v) => setForm((f) => ({ ...f, staffMemberId: v ?? f.staffMemberId }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tip-amount">Amount (£)</Label>
                <Input
                  id="tip-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(v) => setForm((f) => ({ ...f, method: v as "card" | "cash" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving || !form.amount}>
              {saving ? "Saving..." : "Add tips"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
