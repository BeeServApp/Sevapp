"use client"

import { useMemo, useState, useTransition } from "react"
import { Download, RefreshCw, CheckCircle2, Trash2, Plus, Pencil } from "lucide-react"
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
import {
  generateTimecards,
  upsertTimecard,
  deleteTimecard,
  approveAllTimecards,
} from "@/app/actions/scheduling"
import { shiftHours, formatHours, formatMoney, csvCell, addWeeks, weekRangeLabel } from "@/lib/rota"
import type { DbStaffMember, DbTimecard } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

interface Props {
  venueId: number
  weekStart: string
  staff: DbStaffMember[]
  initialTimecards: DbTimecard[]
}

interface EditState {
  card: DbTimecard | null
  staffMemberId: string
  dateISO: string
  clockIn: string
  clockOut: string
  breakMins: string
  payRate: string
}

export function TimecardsTab({ venueId, weekStart, staff, initialTimecards }: Props) {
  const weekEnd = addWeeks(weekStart, 1)
  const [cards, setCards] = useState<DbTimecard[]>(initialTimecards)
  const [isGenerating, startGenerate] = useTransition()
  const [isApproving, startApprove] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  function cardHours(c: DbTimecard) {
    return shiftHours(c.clockIn, c.clockOut, c.breakMins)
  }
  function cardPay(c: DbTimecard) {
    return cardHours(c) * (c.payRatePence ?? 0)
  }

  const totals = useMemo(() => {
    const hours = cards.reduce((s, c) => s + cardHours(c), 0)
    const pay = cards.reduce((s, c) => s + cardPay(c), 0)
    return { hours, pay }
  }, [cards])

  function handleGenerate() {
    setMsg(null)
    startGenerate(async () => {
      const res = await generateTimecards(venueId, weekStart, weekEnd)
      setMsg(
        res.created === 0
          ? "No new timecards — all clock events for this week are already imported."
          : `Imported ${res.created} timecard${res.created > 1 ? "s" : ""} from clock-in data.`,
      )
      // Refresh from server via full reload of data is heavy; instead refetch by reload.
      if (res.created > 0) window.location.reload()
    })
  }

  function handleApproveAll() {
    startApprove(async () => {
      await approveAllTimecards(venueId, weekStart, weekEnd)
      setCards((prev) => prev.map((c) => ({ ...c, status: "approved" })))
      setMsg("All timecards approved for this week.")
    })
  }

  function openNew() {
    setEdit({
      card: null,
      staffMemberId: staff[0] ? String(staff[0].id) : "",
      dateISO: weekStart,
      clockIn: "09:00",
      clockOut: "17:00",
      breakMins: "0",
      payRate: staff[0]?.defaultPayRatePence ? (staff[0].defaultPayRatePence / 100).toFixed(2) : "",
    })
  }

  function openEdit(c: DbTimecard) {
    setEdit({
      card: c,
      staffMemberId: String(c.staffMemberId),
      dateISO: c.dateISO,
      clockIn: c.clockIn ?? "",
      clockOut: c.clockOut ?? "",
      breakMins: String(c.breakMins ?? 0),
      payRate: c.payRatePence ? (c.payRatePence / 100).toFixed(2) : "",
    })
  }

  async function handleSave() {
    if (!edit) return
    const member = staff.find((s) => s.id === Number(edit.staffMemberId))
    if (!member) return
    setSaving(true)
    try {
      const saved = await upsertTimecard({
        id: edit.card?.id,
        venueId,
        staffMemberId: member.id,
        staffName: member.name,
        dateISO: edit.dateISO,
        clockIn: edit.clockIn || null,
        clockOut: edit.clockOut || null,
        breakMins: Number.parseInt(edit.breakMins, 10) || 0,
        payRatePence: edit.payRate ? Math.round(Number.parseFloat(edit.payRate) * 100) : 0,
        status: edit.card?.status ?? "open",
      })
      setCards((prev) => {
        const without = prev.filter((c) => c.id !== saved.id)
        return [saved, ...without]
      })
      setEdit(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteTimecard(id)
    setCards((prev) => prev.filter((c) => c.id !== id))
  }

  function exportCsv() {
    const header = ["Date", "Staff", "Clock in", "Clock out", "Break (mins)", "Hours", "Rate (£/hr)", "Pay (£)", "Status"]
    const lines = [...cards]
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .map((c) =>
        [
          c.dateISO,
          c.staffName,
          c.clockIn ?? "",
          c.clockOut ?? "",
          c.breakMins ?? 0,
          cardHours(c).toFixed(2),
          ((c.payRatePence ?? 0) / 100).toFixed(2),
          (cardPay(c) / 100).toFixed(2),
          c.status,
        ]
          .map(csvCell)
          .join(","),
      )
    const csv = [header.map(csvCell).join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payroll-${weekStart}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Timecards — {weekRangeLabel(weekStart)}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Generated from clock-in/out data. Edit hours and breaks, approve, then export for payroll.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
            <RefreshCw className={cn("size-4", isGenerating && "animate-spin")} />
            {isGenerating ? "Importing..." : "Import from clock-ins"}
          </Button>
          <Button variant="outline" size="sm" onClick={openNew} disabled={staff.length === 0}>
            <Plus className="size-4" /> Add
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={cards.length === 0}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={handleApproveAll} disabled={isApproving || cards.length === 0}>
            <CheckCircle2 className="size-4" /> Approve all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {msg && <p className="px-6 pb-3 text-xs font-medium text-emerald-700">{msg}</p>}
        {cards.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No timecards for this week yet. Use “Import from clock-ins” to generate them, or add one manually.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead className="text-right">Break</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...cards]
                .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
                .map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums text-muted-foreground">{c.dateISO}</TableCell>
                    <TableCell className="font-medium">{c.staffName}</TableCell>
                    <TableCell className="tabular-nums">{c.clockIn ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {c.clockOut ?? <span className="text-amber-600">open</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.breakMins}m</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(cardHours(c))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(cardPay(c))}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-transparent",
                          c.status === "approved"
                            ? "bg-chart-2/15 text-chart-2"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {c.status === "approved" ? "Approved" : "Open"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(c)}>
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={5} className="text-right">
                  Week total
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(totals.hours)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(totals.pay)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{edit?.card ? "Edit timecard" : "Add timecard"}</DialogTitle>
            <DialogDescription>Adjust clock times and breaks. Pay is calculated from the rate.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Staff</Label>
                  <Select
                    value={edit.staffMemberId}
                    onValueChange={(v) => setEdit((e) => (e ? { ...e, staffMemberId: v } : e))}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                <div className="grid gap-2">
                  <Label htmlFor="tc-date">Date</Label>
                  <Input
                    id="tc-date"
                    type="date"
                    value={edit.dateISO}
                    onChange={(e) => setEdit((s) => (s ? { ...s, dateISO: e.target.value } : s))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tc-in">Clock in</Label>
                  <Input
                    id="tc-in"
                    type="time"
                    value={edit.clockIn}
                    onChange={(e) => setEdit((s) => (s ? { ...s, clockIn: e.target.value } : s))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tc-out">Clock out</Label>
                  <Input
                    id="tc-out"
                    type="time"
                    value={edit.clockOut}
                    onChange={(e) => setEdit((s) => (s ? { ...s, clockOut: e.target.value } : s))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tc-break">Break (mins)</Label>
                  <Input
                    id="tc-break"
                    type="number"
                    min="0"
                    value={edit.breakMins}
                    onChange={(e) => setEdit((s) => (s ? { ...s, breakMins: e.target.value } : s))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tc-rate">Pay rate (£/hr)</Label>
                  <Input
                    id="tc-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={edit.payRate}
                    onChange={(e) => setEdit((s) => (s ? { ...s, payRate: e.target.value } : s))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
