"use client"

import { useState } from "react"
import { ClipboardCheck, Loader2, Lock, Minus, Package, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminPinDialog } from "@/components/kiosk/admin-pin-dialog"
import {
  completeKioskStockCount,
  createKioskOrder,
  getKioskProducts,
  getKioskStock,
  saveKioskCountItem,
  startKioskStockCount,
  updateKioskOrderStatus,
  verifyKioskAdminPin,
} from "@/app/actions/kiosk"

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
  const [loading, setLoading] = useState(false)

  // Orders
  const [adding, setAdding] = useState(false)
  const [ref, setRef] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [items, setItems] = useState("")
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
      const s = await getKioskStock(verifiedPin)
      setStock(s)
      setPin(verifiedPin)
    } finally {
      setLoading(false)
    }
  }

  async function addOrder() {
    if (!pin || !ref.trim() || !supplierName.trim()) return
    setError(null)
    try {
      await createKioskOrder({
        pin,
        reference: ref,
        supplier: supplierName,
        items: Number(items) || 0,
      })
      setRef("")
      setSupplierName("")
      setItems("")
      setAdding(false)
      await loadWith(pin)
    } catch (e) {
      setError((e as Error).message)
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
      const products = await getKioskProducts(pin)
      if (products.length === 0) {
        setError("No products to count. Add products in Beeserv → Stock first.")
        return
      }
      const started = await startKioskStockCount(pin)
      setCountId(started.id)
      setCountRef(started.reference)
      setLines(
        products.map((p: Product) => ({
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

  function setQty(productId: number, value: string) {
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
      // Persist any final edits, then complete.
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
        <>
          <div className="mb-5 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Package className="size-6 text-primary" /> Stock orders
            </h1>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground active:scale-95"
            >
              <Plus className="size-5" /> New order
            </button>
          </div>

          {adding && (
            <div className="mb-5 rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="Reference"
                  className="rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Supplier"
                  className="rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={items}
                  onChange={(e) => setItems(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="Item count"
                  className="rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
              <button
                type="button"
                onClick={addOrder}
                disabled={!ref.trim() || !supplierName.trim()}
                className="mt-3 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
              >
                Create order
              </button>
            </div>
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
                          onChange={(e) => setQty(l.productId, e.target.value.replace(/[^\d.]/g, ""))}
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

function pounds(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}
