"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { saveBudget } from "@/app/actions/budget"
import type { DbBudget } from "@/lib/db/schema"

function penceToPounds(p: number | null | undefined): string {
  if (p == null) return ""
  return (p / 100).toString()
}

function poundsToPence(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number.parseFloat(t)
  if (Number.isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

function pctToString(p: number | null | undefined): string {
  return p == null ? "" : String(p)
}

function parsePct(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number.parseFloat(t)
  if (Number.isNaN(n) || n < 0 || n > 100) return null
  return Math.round(n)
}

export function BudgetDialog({
  venueId,
  venueName,
  budget: initial,
  trigger,
}: {
  venueId: number
  venueName: string
  budget?: DbBudget | null
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [weeklySales, setWeeklySales] = useState(penceToPounds(initial?.weeklySalesPence))
  const [monthlySales, setMonthlySales] = useState(penceToPounds(initial?.monthlySalesPence))
  const [labourPct, setLabourPct] = useState(pctToString(initial?.labourPctTarget))
  const [gpPct, setGpPct] = useState(pctToString(initial?.gpPctTarget))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveBudget({
        venueId,
        weeklySalesPence: poundsToPence(weeklySales),
        monthlySalesPence: poundsToPence(monthlySales),
        labourPctTarget: parsePct(labourPct),
        gpPctTarget: parsePct(gpPct),
      })
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targets.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set targets</DialogTitle>
          <DialogDescription>
            Performance targets for {venueName}. Used to drive the traffic-light indicators.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <section className="grid gap-4">
            <h3 className="text-sm font-semibold text-foreground">Sales</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="budget-weekly">Weekly sales (£)</Label>
                <Input
                  id="budget-weekly"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={weeklySales}
                  onChange={(e) => setWeeklySales(e.target.value)}
                  placeholder="e.g. 12000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budget-monthly">Monthly sales (£)</Label>
                <Input
                  id="budget-monthly"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={monthlySales}
                  onChange={(e) => setMonthlySales(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="grid gap-4">
            <h3 className="text-sm font-semibold text-foreground">Margins</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="budget-gp">Gross profit target (%)</Label>
                <Input
                  id="budget-gp"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  value={gpPct}
                  onChange={(e) => setGpPct(e.target.value)}
                  placeholder="e.g. 70"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budget-labour">Labour cost target (%)</Label>
                <Input
                  id="budget-labour"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  value={labourPct}
                  onChange={(e) => setLabourPct(e.target.value)}
                  placeholder="e.g. 25"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Sales and gross profit are on target when at or above the goal. Labour cost is on
              target when at or below the goal.
            </p>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save targets"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
