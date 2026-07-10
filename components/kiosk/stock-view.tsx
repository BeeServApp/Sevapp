"use client"

import { useState } from "react"
import { Loader2, Lock, Package, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminPinDialog } from "@/components/kiosk/admin-pin-dialog"
import {
  createKioskOrder,
  getKioskStock,
  updateKioskOrderStatus,
  verifyKioskAdminPin,
} from "@/app/actions/kiosk"

type Stock = Awaited<ReturnType<typeof getKioskStock>>
const ORDER_STATUSES = ["Draft", "Submitted", "Delivered"] as const

export function StockView({ hasAdminPin }: { hasAdminPin: boolean }) {
  const [pin, setPin] = useState<string | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [stock, setStock] = useState<Stock | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [ref, setRef] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [items, setItems] = useState("")
  const [error, setError] = useState<string | null>(null)

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
    </div>
  )
}
