"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
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
import { createExpense, deleteExpense } from "@/app/actions/financials"
import type { DbExpense } from "@/lib/db/schema"

const CATEGORIES = ["Staff", "Utilities", "Stock", "Maintenance", "Marketing", "Other"]
const STATUSES = ["Paid", "Pending", "Overdue"]

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
})

interface Props {
  venueId: number
  initialExpenses: DbExpense[]
}

export function FinancialsExpenses({ venueId, initialExpenses }: Props) {
  const [expenses, setExpenses] = useState<DbExpense[]>(initialExpenses)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({
    category: "Stock",
    vendor: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    status: "Pending",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!form.vendor.trim()) return setError("Enter a vendor name.")
    const amount = Number.parseFloat(form.amount)
    if (Number.isNaN(amount) || amount < 0) return setError("Enter a valid amount.")
    if (!form.date) return setError("Enter a date.")
    setError(null)
    setSaving(true)
    try {
      const created = await createExpense({
        venueId,
        category: form.category,
        vendor: form.vendor.trim(),
        amountPence: Math.round(amount * 100),
        date: new Date(form.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        status: form.status,
      })
      setExpenses((prev) => [created, ...prev])
      setAddOpen(false)
      setForm({
        category: "Stock",
        vendor: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        status: "Pending",
      })
    } catch {
      setError("Failed to add expense.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this expense?")) return
    await deleteExpense(id)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent expenses</CardTitle>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add expense
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {expenses.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No expenses yet. Add your first one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{x.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {x.vendor} · {x.date}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {gbp.format(x.amountPence / 100)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={x.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(x.id)}
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>Record a new venue expense.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="exp-cat">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? f.category }))}
                >
                  <SelectTrigger id="exp-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exp-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v ?? f.status }))}
                >
                  <SelectTrigger id="exp-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-vendor">Vendor</Label>
              <Input
                id="exp-vendor"
                value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                placeholder="e.g. AceCool Ltd"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="exp-amount">Amount (£)</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? "Saving..." : "Add expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
