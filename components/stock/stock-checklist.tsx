"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ClipboardList, Loader2, Minus, Plus, Printer, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createStockOrder, type OrderLineInput } from "@/app/actions/stock"
import { buildReorderList, poundsFromPence } from "@/lib/stock"
import type { DbStockProduct, DbSupplier } from "@/lib/db/schema"

const UNASSIGNED = "unassigned"

/**
 * A staff-facing "what to order" checklist. It lists every product that has
 * dropped below its par level, grouped by supplier, with a suggested order
 * quantity that can be adjusted. Staff can print the list to take when ordering
 * or turn a supplier's group straight into a draft purchase order.
 */
export function StockChecklist({
  venueId,
  products,
  suppliers,
}: {
  venueId: number
  products: DbStockProduct[]
  suppliers: DbSupplier[]
}) {
  const router = useRouter()
  const [qty, setQty] = useState<Record<number, number>>({})
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supplierName = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of suppliers) map.set(s.id, s.name)
    return map
  }, [suppliers])

  const reorder = useMemo(
    () =>
      buildReorderList(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          unit: p.unit,
          packSize: p.packSize,
          parLevel: p.parLevel,
          onHandQty: p.onHandQty,
          costPricePence: p.costPricePence,
          supplierId: p.supplierId ?? null,
        })),
      ),
    [products],
  )

  // Group reorder lines by supplier so each group becomes one purchase order.
  const groups = useMemo(() => {
    const bySupplier = new Map<string, typeof reorder>()
    for (const line of reorder) {
      const key = line.supplierId != null ? String(line.supplierId) : UNASSIGNED
      const arr = bySupplier.get(key) ?? []
      arr.push(line)
      bySupplier.set(key, arr)
    }
    return [...bySupplier.entries()].map(([key, lines]) => ({
      key,
      supplier: key === UNASSIGNED ? "Unassigned" : supplierName.get(Number(key)) ?? "Unknown supplier",
      lines,
    }))
  }, [reorder, supplierName])

  function effectiveQty(productId: number, suggested: number) {
    return qty[productId] ?? suggested
  }

  function setLineQty(productId: number, value: number) {
    setQty((q) => ({ ...q, [productId]: Math.max(0, Math.round(value * 100) / 100) }))
  }

  const grandTotal = reorder.reduce(
    (sum, l) => sum + Math.round(effectiveQty(l.productId, l.suggestedQty) * l.unitCostPence),
    0,
  )

  async function createOrderForGroup(group: (typeof groups)[number]) {
    setError(null)
    setCreating(group.key)
    try {
      const lines: OrderLineInput[] = group.lines
        .map((l) => ({
          productId: l.productId,
          name: l.name,
          qty: effectiveQty(l.productId, l.suggestedQty),
          unitCostPence: l.unitCostPence,
        }))
        .filter((l) => l.qty > 0)
      if (lines.length === 0) {
        setError("Nothing to order in this group — all quantities are zero.")
        return
      }
      const stamp = new Date().toISOString().slice(5, 10).replace("-", "")
      await createStockOrder({
        venueId,
        reference: `RO-${stamp}-${Math.floor(Math.random() * 900 + 100)}`,
        supplier: group.supplier === "Unassigned" ? "Unassigned" : group.supplier,
        status: "Draft",
        lines,
      })
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(null)
    }
  }

  if (reorder.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <ClipboardList className="size-6" />
          </span>
          <div>
            <p className="font-medium text-foreground">Everything is above par</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No products need reordering right now. Items drop onto this list automatically as stock falls below its
              par level.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-near" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{reorder.length} item(s)</span> below par. Suggested
            quantities are rounded up to each product&apos;s pack size.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Est. total{" "}
            <span className="font-semibold text-foreground">{poundsFromPence(grandTotal)}</span>
          </span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" /> Print list
          </Button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive print:hidden">{error}</p>}

      {groups.map((group) => {
        const groupTotal = group.lines.reduce(
          (sum, l) => sum + Math.round(effectiveQty(l.productId, l.suggestedQty) * l.unitCostPence),
          0,
        )
        return (
          <Card key={group.key}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{group.supplier}</span>
                  <Badge variant="secondary">{group.lines.length}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{poundsFromPence(groupTotal)}</span>
                  <Button
                    size="sm"
                    className="gap-1.5 print:hidden"
                    disabled={creating !== null}
                    onClick={() => createOrderForGroup(group)}
                  >
                    {creating === group.key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Create draft order
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {group.lines.map((l) => {
                  const current = effectiveQty(l.productId, l.suggestedQty)
                  return (
                    <li key={l.productId} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.category} · on hand {formatQty(l.onHandQty)} / par {formatQty(l.parLevel)} {l.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 print:hidden">
                        <button
                          type="button"
                          onClick={() => setLineQty(l.productId, current - 1)}
                          className="flex size-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                          aria-label={`Decrease ${l.name}`}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold tabular-nums">{formatQty(current)}</span>
                        <button
                          type="button"
                          onClick={() => setLineQty(l.productId, current + 1)}
                          className="flex size-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                          aria-label={`Increase ${l.name}`}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="hidden w-16 text-right text-sm font-semibold tabular-nums print:block">
                        {formatQty(current)} {l.unit}
                      </div>
                      <div className="w-20 text-right text-sm tabular-nums text-muted-foreground">
                        {poundsFromPence(Math.round(current * l.unitCostPence))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.0+$/, "")
}
