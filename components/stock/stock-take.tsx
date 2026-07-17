"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ClipboardCheck, Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { poundsFromPence } from "@/lib/stock"
import {
  completeStockCount,
  deleteStockCount,
  getStockCountItems,
  startStockCount,
  updateCountItemQty,
} from "@/app/actions/stock"
import type { DbStockCount, DbStockCountItem } from "@/lib/db/schema"

export function StockTake({ venueId, counts }: { venueId: number; counts: DbStockCount[] }) {
  const router = useRouter()
  const [activeCount, setActiveCount] = useState<DbStockCount | null>(null)
  const [items, setItems] = useState<DbStockCountItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<DbStockCount | null>(null)

  async function openCount(c: DbStockCount) {
    setActiveCount(c)
    setLoading(true)
    try {
      setItems(await getStockCountItems(c.id))
    } finally {
      setLoading(false)
    }
  }

  if (activeCount) {
    return (
      <CountEditor
        count={activeCount}
        items={items}
        loading={loading}
        onBack={() => {
          setActiveCount(null)
          router.refresh()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Count physical stock and reconcile against expected quantities to reveal variance.
        </p>
        <NewCountDialog venueId={venueId} onStarted={openCount} />
      </div>

      {counts.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No stock takes yet. Start one to count your shelves and cellar.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map((c) => {
            const variance = c.varianceValuePence
            const done = c.status === "Completed"
            return (
              <Card key={c.id} className="gap-0">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{c.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.area || "All areas"}
                        {c.countedBy ? ` · ${c.countedBy}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-transparent font-medium",
                        done ? "bg-primary/10 text-primary" : "bg-chart-4/20 text-[oklch(0.45_0.11_70)]",
                      )}
                    >
                      {c.status}
                    </Badge>
                  </div>

                  {done && (
                    <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                      <span className="text-muted-foreground">Variance</span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          variance < 0 ? "text-destructive" : "text-primary",
                        )}
                      >
                        {variance > 0 ? "+" : ""}
                        {poundsFromPence(variance)}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => openCount(c)}>
                      {done ? "View" : "Continue count"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${c.reference}`}
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this stock take?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleting?.reference}” and its counted lines. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting) await deleteStockCount(deleting.id)
                setDeleting(null)
                router.refresh()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function NewCountDialog({
  venueId,
  onStarted,
}: {
  venueId: number
  onStarted: (c: DbStockCount) => void
}) {
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState("")
  const [area, setArea] = useState("")
  const [countedBy, setCountedBy] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setError(null)
    setSaving(true)
    try {
      const created = await startStockCount({ venueId, reference, area, countedBy })
      setOpen(false)
      setReference("")
      setArea("")
      setCountedBy("")
      onStarted(created)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" /> Start stock take
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a stock take</DialogTitle>
          <DialogDescription>Snapshots every active product so you can count actuals.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-ref">Reference</Label>
            <Input
              id="c-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Week 24 count"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-area">Area</Label>
              <Input id="c-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Cellar" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-by">Counted by</Label>
              <Input id="c-by" value={countedBy} onChange={(e) => setCountedBy(e.target.value)} placeholder="Name" />
            </div>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={start} disabled={saving || !reference.trim()}>
            {saving ? "Starting…" : "Start count"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CountEditor({
  count,
  items,
  loading,
  onBack,
}: {
  count: DbStockCount
  items: DbStockCountItem[]
  loading: boolean
  onBack: () => void
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, String(i.countedQty)])),
  )
  const [completing, setCompleting] = useState(false)
  const done = count.status === "Completed"

  // Re-sync local values when items finish loading.
  if (!loading && items.length > 0 && Object.keys(values).length === 0) {
    setValues(Object.fromEntries(items.map((i) => [i.id, String(i.countedQty)])))
  }

  function counted(i: DbStockCountItem) {
    const raw = values[i.id]
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n : 0
  }

  const expectedValue = items.reduce((s, i) => s + Math.round(i.expectedQty * i.unitCostPence), 0)
  const countedValue = items.reduce((s, i) => s + Math.round(counted(i) * i.unitCostPence), 0)
  const variance = countedValue - expectedValue

  async function saveItem(i: DbStockCountItem) {
    if (done) return
    await updateCountItemQty(i.id, counted(i))
  }

  async function finish() {
    setCompleting(true)
    try {
      // Persist any edited values first, then complete.
      await Promise.all(items.map((i) => updateCountItemQty(i.id, counted(i))))
      await completeStockCount(count.id)
      onBack()
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardCheck className="size-5 text-primary" /> {count.reference}
            </h2>
            <p className="text-xs text-muted-foreground">{count.area || "All areas"}</p>
          </div>
        </div>
        {!done && (
          <Button onClick={finish} disabled={completing || loading}>
            {completing ? "Completing…" : "Complete & reconcile"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="gap-0 p-4">
          <p className="text-xs text-muted-foreground">Expected value</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{poundsFromPence(expectedValue)}</p>
        </Card>
        <Card className="gap-0 p-4">
          <p className="text-xs text-muted-foreground">Counted value</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{poundsFromPence(countedValue)}</p>
        </Card>
        <Card className="gap-0 p-4">
          <p className="text-xs text-muted-foreground">Variance</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              variance < 0 ? "text-destructive" : "text-primary",
            )}
          >
            {variance > 0 ? "+" : ""}
            {poundsFromPence(variance)}
          </p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((i) => {
                const c = counted(i)
                const diff = c - i.expectedQty
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Expected {i.expectedQty} · {poundsFromPence(i.unitCostPence)}/unit
                      </p>
                    </div>
                    {diff !== 0 && (
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          diff < 0 ? "text-destructive" : "text-primary",
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(2).replace(/\.00$/, "")}
                      </span>
                    )}
                    <Input
                      inputMode="decimal"
                      disabled={done}
                      value={values[i.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [i.id]: e.target.value }))}
                      onBlur={() => saveItem(i)}
                      className="w-20 text-right"
                      aria-label={`Counted quantity for ${i.name}`}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
