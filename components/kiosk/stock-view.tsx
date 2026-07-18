"use client"

import { useMemo, useState } from "react"
import {
  ClipboardCheck,
  Loader2,
  Lock,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminPinDialog } from "@/components/kiosk/admin-pin-dialog"
import {
  completeKioskStockCount,
  createKioskOrderFromLines,
  getKioskProducts,
  getKioskStock,
  saveKioskCountItem,
  startKioskStockCount,
  updateKioskOrderStatus,
  verifyKioskAdminPin,
} from "@/app/actions/kiosk"
import { buildReorderList } from "@/lib/stock"

type Stock = Awaited<ReturnType<typeof getKioskStock>>
type Product = Awaited<ReturnType<typeof getKioskProducts>>[number]
const ORDER_STATUSES = ["Draft", "Submitted", "Delivered"] as const

type Tab = "orders" | "count"

interface CountLine {
  productId: number
  name: string
  category: string
  unit: string
  qty: number
}

export function StockView({ hasAdminPin }: { hasAdminPin: boolean }) {
  const [pin, setPin] = useState<string | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("orders")
  const [stock, setStock] = useState<Stock | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // Order builder (shopping-list basket)
  const [building, setBuilding] = useState(false)
  const [supplierName, setSupplierName] = useState("")
  const [query, setQuery] = useState("")
  const [basket, setBasket] = useState<Record<number, number>>({})
  const [savingOrder, setSavingOrder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stock take
  const [countId, setCountId] = useState<number | null>(null)
  const [countRef, setCountRef] = useState<string>("")
  const [lines, setLines] = useState<CountLine[]>([])
  const [countBusy, setCountBusy] = useState(false)
  const [countDone, setCountDone] = useState<{ counted: number; variance: number } | null>(null)

  async function loadWith(verifiedPin: string) {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([getKioskStock(verifiedPin), getKioskProducts(verifiedPin)])
      setStock(s)
      setProducts(p)
      setPin(verifiedPin)
    } finally {
      setLoading(false)
    }
  }

  const suppliers = stock?.suppliers ?? []

  // Products for the basket: below-par first (to prompt restocking), then name.
  const catalogue = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const aLow = a.onHandQty < a.parLevel ? 0 : 1
        const bLow = b.onHandQty < b.parLevel ? 0 : 1
        return aLow - bLow || a.name.localeCompare(b.name)
      })
  }, [products, query])

  const basketLines = useMemo(
    () =>
      Object.entries(basket)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === Number(id))
          return p ? { product: p, qty } : null
        })
        .filter((x): x is { product: Product; qty: number } => !!x && x.qty > 0),
    [basket, products],
  )

  const basketTotal = basketLines.reduce((sum, l) => sum + Math.round(l.qty * l.product.costPricePence), 0)
  const belowParCount = products.filter((p) => p.onHandQty < p.parLevel).length

  function setQty(id: number, qty: number) {
    setBasket((b) => {
      const next = { ...b }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
  }

  // Fill the basket with everything below par, at pack-rounded suggested qtys.
  function suggestReorder() {
    const reorder = buildReorderList(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        packSize: p.packSize,
        parLevel: p.parLevel,
        onHandQty: p.onHandQty,
        costPricePence: p.costPricePence,
        supplierId: p.supplierId,
      })),
    )
    const next: Record<number, number> = {}
    for (const l of reorder) next[l.productId] = l.suggestedQty
    setBasket(next)
  }

  function resetOrder() {
    setBuilding(false)
    setSupplierName("")
    setQuery("")
    setBasket({})
    setError(null)
  }

  async function submitOrder() {
    if (!pin) return
    setError(null)
    if (!supplierName.trim()) {
      setError("Choose a supplier")
      return
    }
    if (basketLines.length === 0) {
      setError("Add at least one product")
      return
    }
    setSavingOrder(true)
    try {
      await createKioskOrderFromLines({
        pin,
        supplier: supplierName,
        lines: basketLines.map((l) => ({
          productId: l.product.id,
          name: l.product.name,
          qty: l.qty,
          unitCostPence: l.product.costPricePence,
        })),
      })
      resetOrder()
      await loadWith(pin)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingOrder(false)
    }
  }

  async function cycleStatus(orderId: number, current: string) {
    if (!pin) return
    const idx = ORDER_STATUSES.indexOf(current as (typeof ORDER_STATUSES)[number])
    const next = ORDER_STATUSES[(idx + 1) % ORDER_STATUSES.length]
    await updateKioskOrderStatus(pin, orderId, next)
    await loadWith(pin)
  }

  async function beginCount() {
    if (!pin) return
    setCountBusy(true)
    setCountDone(null)
    setError(null)
    try {
      const list = await getKioskProducts(pin)
      if (list.length === 0) {
        setError("No products to count. Add products in Beeserv → Stock first.")
        return
      }
      const started = await startKioskStockCount(pin)
      setCountId(started.id)
      setCountRef(started.reference)
      setLines(
        list.map((p: Product) => ({
          productId: p.id,
          name: p.name,
          category: p.category,
          unit: p.unit,
          qty: p.onHandQty,
        })),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCountBusy(false)
    }
  }

  function adjust(productId: number, delta: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, qty: Math.max(0, Math.round((l.qty + delta) * 100) / 100) } : l,
      ),
    )
  }

  function setCountQty(productId: number, value: string) {
    const n = value === "" ? 0 : Number(value)
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, qty: Number.isFinite(n) ? n : 0 } : l)))
  }

  async function persistLine(line: CountLine) {
    if (!pin || countId == null) return
    await saveKioskCountItem(pin, countId, line.productId, line.qty)
  }

  async function finishCount() {
    if (!pin || countId == null) return
    setCountBusy(true)
    try {
      await Promise.all(lines.map((l) => saveKioskCountItem(pin, countId, l.productId, l.qty)))
      const res = await completeKioskStockCount(pin, countId)
      setCountDone({ counted: res.countedValuePence, variance: res.varianceValuePence })
      setCountId(null)
      setLines([])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCountBusy(false)
    }
  }

  // Locked state — require manager PIN before showing any stock data.
  if (!pin) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          <Lock className="size-8" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Stock management</h1>
          <p className="mt-1 text-muted-foreground">
            {hasAdminPin
              ? "Manager access required. Enter the manager PIN to continue."
              : "No manager PIN is set. Ask the owner to set one in Beeserv → Settings → Kiosk."}
          </p>
        </div>
        <button
          type="button"
          disabled={!hasAdminPin}
          onClick={() => setPinOpen(true)}
          className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
        >
          Unlock
        </button>
        <AdminPinDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          title="Manager PIN"
          description="Stock is restricted to managers."
          onSubmit={(p) => verifyKioskAdminPin(p)}
          onSuccess={(p) => loadWith(p)}
        />
      </div>
    )
  }

  if (loading && !stock) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Tab switch */}
      <div className="mb-5 flex gap-2 rounded-2xl bg-secondary p-1">
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold active:scale-[0.98]",
            tab === "orders" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          <Package className="size-5" /> Orders
        </button>
        <button
          type="button"
          onClick={() => setTab("count")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold active:scale-[0.98]",
            tab === "count" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          <ClipboardCheck className="size-5" /> Stock take
        </button>
      </div>

      {tab === "orders" ? (
        building ? (
          <OrderBuilder
            catalogue={catalogue}
            suppliers={suppliers}
            supplierName={supplierName}
            setSupplierName={setSupplierName}
            query={query}
            setQuery={setQuery}
            basket={basket}
            basketLines={basketLines}
            basketTotal={basketTotal}
            belowParCount={belowParCount}
            setQty={setQty}
            onSuggest={suggestReorder}
            onCancel={resetOrder}
            onSubmit={submitOrder}
            saving={savingOrder}
            error={error}
          />
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                <Package className="size-6 text-primary" /> Stock orders
              </h1>
              <button
                type="button"
                onClick={() => {
                  setBuilding(true)
                  setError(null)
                }}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground active:scale-95"
              >
                <Plus className="size-5" /> New order
              </button>
            </div>

            {belowParCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBuilding(true)
                  suggestReorder()
                }}
                className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-status-near/10 p-4 text-left ring-1 ring-status-near/30 active:scale-[0.99]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-near/20 text-status-near">
                  <Sparkles className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {belowParCount} item{belowParCount === 1 ? "" : "s"} below par
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Tap to start an order with suggested quantities filled in.
                  </span>
                </span>
              </button>
            )}

            {!stock || stock.orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                No orders yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {stock.orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{o.reference}</div>
                      <div className="text-sm text-muted-foreground">
                        {o.supplier} · {o.items} item{o.items === 1 ? "" : "s"}
                        {o.totalPence ? ` · ${pounds(o.totalPence)}` : ""}
                        {o.due ? ` · due ${o.due}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => cycleStatus(o.id, o.status)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-semibold active:scale-95",
                        o.status === "Delivered"
                          ? "bg-primary/10 text-primary"
                          : o.status === "Submitted"
                            ? "bg-status-near/15 text-status-near"
                            : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {o.status}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ClipboardCheck className="size-6 text-primary" /> Stock take
            </h1>
            {countId != null && (
              <span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                {countRef}
              </span>
            )}
          </div>

          {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

          {countId == null ? (
            <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-border">
              {countDone ? (
                <div className="mb-6">
                  <p className="text-lg font-semibold">Count complete</p>
                  <p className="mt-1 text-muted-foreground">
                    Counted value {pounds(countDone.counted)} ·{" "}
                    <span className={countDone.variance < 0 ? "text-destructive" : "text-primary"}>
                      {countDone.variance >= 0 ? "+" : ""}
                      {pounds(countDone.variance)} variance
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mb-6 text-muted-foreground">
                  Start a count to walk through every product and record what&apos;s physically on the shelf. Results
                  sync straight to Beeserv.
                </p>
              )}
              <button
                type="button"
                onClick={beginCount}
                disabled={countBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
              >
                {countBusy ? <Loader2 className="size-5 animate-spin" /> : <ClipboardCheck className="size-5" />}
                {countDone ? "Start new count" : "Start stock take"}
              </button>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3 pb-28">
                {lines.map((l) => (
                  <li key={l.productId} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{l.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {l.category} · per {l.unit}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adjust(l.productId, -1)}
                          onPointerUp={() => persistLine(l)}
                          className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-90"
                          aria-label={`Decrease ${l.name}`}
                        >
                          <Minus className="size-5" />
                        </button>
                        <input
                          value={String(l.qty)}
                          onChange={(e) => setCountQty(l.productId, e.target.value.replace(/[^\d.]/g, ""))}
                          onBlur={() => persistLine(l)}
                          inputMode="decimal"
                          className="w-16 rounded-xl border border-input bg-background py-2.5 text-center text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Count for ${l.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => adjust(l.productId, 1)}
                          onPointerUp={() => persistLine(l)}
                          className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90"
                          aria-label={`Increase ${l.name}`}
                        >
                          <Plus className="size-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center gap-3">
                  <div className="flex-1 text-sm text-muted-foreground">
                    {lines.length} product{lines.length === 1 ? "" : "s"} to count
                  </div>
                  <button
                    type="button"
                    onClick={finishCount}
                    disabled={countBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
                  >
                    {countBusy ? <Loader2 className="size-5 animate-spin" /> : <ClipboardCheck className="size-5" />}
                    Finish &amp; sync
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Full-screen touch-friendly order builder: tap products to add to a basket. */
function OrderBuilder({
  catalogue,
  suppliers,
  supplierName,
  setSupplierName,
  query,
  setQuery,
  basket,
  basketLines,
  basketTotal,
  belowParCount,
  setQty,
  onSuggest,
  onCancel,
  onSubmit,
  saving,
  error,
}: {
  catalogue: Product[]
  suppliers: { id: number; name: string }[]
  supplierName: string
  setSupplierName: (v: string) => void
  query: string
  setQuery: (v: string) => void
  basket: Record<number, number>
  basketLines: { product: Product; qty: number }[]
  basketTotal: number
  belowParCount: number
  setQty: (id: number, qty: number) => void
  onSuggest: () => void
  onCancel: () => void
  onSubmit: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div className="pb-32">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShoppingCart className="size-6 text-primary" /> New order
        </h1>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-secondary px-4 py-2.5 font-semibold text-secondary-foreground active:scale-95"
        >
          Cancel
        </button>
      </div>

      {/* Supplier chooser */}
      <div className="mb-3">
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Supplier</label>
        {suppliers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            No suppliers yet. Add one in Beeserv → Stock → Suppliers.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {suppliers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSupplierName(s.name)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95",
                  supplierName === s.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search + suggest */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {belowParCount > 0 && (
          <button
            type="button"
            onClick={onSuggest}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-status-near/15 px-4 font-semibold text-status-near active:scale-95"
          >
            <Sparkles className="size-5" /> Suggest
          </button>
        )}
      </div>

      {/* Catalogue */}
      {catalogue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No products found.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {catalogue.map((p) => {
            const inBasket = basket[p.id] ?? 0
            const low = p.onHandQty < p.parLevel
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border",
                  inBasket > 0 && "ring-2 ring-primary",
                )}
              >
                <button
                  type="button"
                  onClick={() => setQty(p.id, inBasket + 1)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{p.name}</span>
                    {low && (
                      <span className="shrink-0 rounded-full bg-status-near/15 px-2 py-0.5 text-xs font-medium text-status-near">
                        Low
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {pounds(p.costPricePence)}/{p.unit} · on hand {formatQty(p.onHandQty)} / par{" "}
                    {formatQty(p.parLevel)}
                  </div>
                </button>
                {inBasket > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQty(p.id, inBasket - 1)}
                      className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-90"
                      aria-label={`Decrease ${p.name}`}
                    >
                      <Minus className="size-5" />
                    </button>
                    <span className="w-8 text-center text-lg font-semibold tabular-nums">{formatQty(inBasket)}</span>
                    <button
                      type="button"
                      onClick={() => setQty(p.id, inBasket + 1)}
                      className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90"
                      aria-label={`Increase ${p.name}`}
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQty(p.id, 1)}
                    className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-90"
                    aria-label={`Add ${p.name}`}
                  >
                    <Plus className="size-5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Sticky basket summary */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{basketLines.length}</span> line
              {basketLines.length === 1 ? "" : "s"}
              {basketLines.length > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-foreground">{pounds(basketTotal)}</span>
                </>
              )}
            </div>
            {basketLines.length > 0 && (
              <button
                type="button"
                onClick={() => basketLines.forEach((l) => setQty(l.product.id, 0))}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground active:scale-95"
              >
                <Trash2 className="size-4" /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving || basketLines.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <ShoppingCart className="size-5" />}
              Place order
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function pounds(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.0+$/, "")
}
