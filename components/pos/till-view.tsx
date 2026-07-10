"use client"

import { useMemo, useState } from "react"
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react"

import type { DbPosCategory, DbPosProduct, DbPosTerminal } from "@/lib/db/schema"
import { cn } from "@/lib/utils"
import { formatPence } from "@/lib/pos-format"
import { Button } from "@/components/ui/button"
import { PayDialog } from "@/components/pos/pay-dialog"

export interface OrderLine {
  productId: number
  name: string
  unitPricePence: number
  qty: number
}

export function TillView({
  venueId,
  userName,
  categories,
  products,
  terminals,
  onSaleComplete,
}: {
  venueId: number
  userName: string
  categories: DbPosCategory[]
  products: DbPosProduct[]
  terminals: DbPosTerminal[]
  onSaleComplete: (totalPence: number) => void
}) {
  const [activeCategory, setActiveCategory] = useState<number | "all">("all")
  const [lines, setLines] = useState<OrderLine[]>([])
  const [payOpen, setPayOpen] = useState(false)

  const visibleProducts = useMemo(
    () => (activeCategory === "all" ? products : products.filter((p) => p.categoryId === activeCategory)),
    [products, activeCategory],
  )

  const subtotalPence = useMemo(() => lines.reduce((sum, l) => sum + l.unitPricePence * l.qty, 0), [lines])
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines])

  function addProduct(p: DbPosProduct) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { productId: p.id, name: p.name, unitPricePence: p.pricePence, qty: 1 }]
    })
  }

  function changeQty(productId: number, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    )
  }

  function removeLine(productId: number) {
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }

  function clearOrder() {
    setLines([])
  }

  function handlePaid(totalPence: number) {
    onSaleComplete(totalPence)
    setLines([])
    setPayOpen(false)
  }

  return (
    <div className="flex h-full">
      {/* Product area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Category filter */}
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-background p-3">
          <CategoryChip active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
            All
          </CategoryChip>
          {categories.map((c) => (
            <CategoryChip key={c.id} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)}>
              {c.name}
            </CategoryChip>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {visibleProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <ShoppingCart className="size-8" />
              <p className="text-sm">
                {products.length === 0 ? "No products yet — add some in Manage." : "No products in this category."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex min-h-24 flex-col justify-between rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-brand hover:bg-brand/5 active:scale-[0.98]"
                  style={p.color ? { borderLeftColor: p.color, borderLeftWidth: 4 } : undefined}
                >
                  <span className="line-clamp-2 text-sm font-medium text-foreground">{p.name}</span>
                  <span className="mt-2 text-sm font-semibold text-brand">{formatPence(p.pricePence)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order panel */}
      <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-background">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">Current order</h2>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={clearOrder}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <ShoppingCart className="size-7" />
              <p className="text-sm">Tap products to start an order.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-2 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPence(l.unitPricePence)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Decrease ${l.name}`}
                      onClick={() => changeQty(l.productId, -1)}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${l.name}`}
                      onClick={() => changeQty(l.productId, 1)}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatPence(l.unitPricePence * l.qty)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${l.name}`}
                    onClick={() => removeLine(l.productId)}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="text-xl font-bold text-foreground">{formatPence(subtotalPence)}</span>
          </div>
          <Button
            className="h-14 w-full text-base"
            disabled={lines.length === 0}
            onClick={() => setPayOpen(true)}
          >
            Charge {formatPence(subtotalPence)}
          </Button>
        </div>
      </aside>

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        venueId={venueId}
        userName={userName}
        lines={lines}
        totalPence={subtotalPence}
        terminals={terminals}
        onPaid={handlePaid}
      />
    </div>
  )
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand text-brand-foreground"
          : "border border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
