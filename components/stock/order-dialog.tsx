"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { createStockOrder, type OrderLineInput } from "@/app/actions/stock"
import { poundsFromPence } from "@/lib/stock"
import type { DbStockProduct, DbSupplier } from "@/lib/db/schema"

/**
 * Build a purchase order like a shopping list: filter the catalogue, tap to add
 * products to the basket, adjust quantities, and the total is derived live.
 */
export function OrderDialog({
  venueId,
  products,
  suppliers,
}: {
  venueId: number
  products: DbStockProduct[]
  suppliers: DbSupplier[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [query, setQuery] = useState("")
  const [basket, setBasket] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When a supplier is chosen, prioritise its products but still allow adding
  // anything else in the catalogue.
  const supplierId = useMemo(
    () => suppliers.find((s) => s.name === supplierName)?.id ?? null,
    [suppliers, supplierName],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => p.active)
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => {
        // Below-par items first to prompt restocking, then by name.
        const aLow = a.onHandQty < a.parLevel ? 0 : 1
        const bLow = b.onHandQty < b.parLevel ? 0 : 1
        return aLow - bLow || a.name.localeCompare(b.name)
      })
      .slice(0, 40)
  }, [products, query])

  const lines = useMemo(
    () =>
      Object.entries(basket)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === Number(id))
          return p ? { product: p, qty } : null
        })
        .filter((x): x is { product: DbStockProduct; qty: number } => !!x && x.qty > 0),
    [basket, products],
  )

  const totalPence = lines.reduce((sum, l) => sum + Math.round(l.qty * l.product.costPricePence), 0)

  function setQty(id: number, qty: number) {
    setBasket((b) => {
      const next = { ...b }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!reference.trim()) return setError("Add an order reference")
    if (!supplierName.trim()) return setError("Choose a supplier")
    if (lines.length === 0) return setError("Add at least one product to the order")
    setSaving(true)
    const payload: OrderLineInput[] = lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      qty: l.qty,
      unitCostPence: l.product.costPricePence,
    }))
    try {
      await createStockOrder({
        venueId,
        reference,
        supplier: supplierName,
        status: "Draft",
        lines: payload,
      })
      setOpen(false)
      setReference("")
      setSupplierName("")
      setBasket({})
      setQuery("")
      router.refresh()
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
            <Plus className="size-4" /> New order
          </Button>
        }
      />
      <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New stock order</DialogTitle>
          <DialogDescription>Pick products like a shopping list — quantities build the order.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="o-ref">Reference</Label>
              <Input
                id="o-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. PO-1042"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Supplier</Label>
              <Select value={supplierName} onValueChange={setSupplierName}>
                <SelectTrigger aria-label="Supplier">
                  <SelectValue placeholder="Choose a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Add a supplier first
                    </SelectItem>
                  ) : (
                    suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Catalogue */}
            <div className="flex flex-col gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
              />
              <div className="h-64 overflow-y-auto rounded-lg ring-1 ring-border">
                {filtered.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No products found. Ask the owner to add products first.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {filtered.map((p) => {
                      const low = p.onHandQty < p.parLevel
                      const inBasket = basket[p.id] ?? 0
                      const preferred = supplierId != null && p.supplierId === supplierId
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setQty(p.id, inBasket + 1)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-secondary"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {p.name}
                                {preferred && <span className="ml-1 text-xs text-primary">★</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {poundsFromPence(p.costPricePence)}/{p.unit}
                                {low && <span className="ml-2 text-destructive">Below par</span>}
                              </p>
                            </div>
                            {inBasket > 0 ? (
                              <Badge className="shrink-0">{inBasket}</Badge>
                            ) : (
                              <Plus className="size-4 shrink-0 text-muted-foreground" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Basket */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShoppingCart className="size-4" /> Order ({lines.length})
              </div>
              <div className="h-64 overflow-y-auto rounded-lg ring-1 ring-border">
                {lines.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Tap products to add them here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {lines.map((l) => (
                      <li key={l.product.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{l.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {poundsFromPence(Math.round(l.qty * l.product.costPricePence))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQty(l.product.id, l.qty - 1)}
                            className="flex size-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                            aria-label={`Decrease ${l.product.name}`}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm tabular-nums">{l.qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(l.product.id, l.qty + 1)}
                            className="flex size-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                            aria-label={`Increase ${l.product.name}`}
                          >
                            <Plus className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQty(l.product.id, 0)}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${l.product.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter className={cn("flex-row items-center justify-between gap-3 sm:justify-between")}>
            <div className="text-sm text-muted-foreground">
              Total{" "}
              <span className="text-base font-semibold text-foreground">{poundsFromPence(totalPence)}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || lines.length === 0}>
                {saving ? "Creating…" : "Create order"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
