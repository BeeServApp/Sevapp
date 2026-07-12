"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardList,
  MoreVertical,
  Package,
  Pencil,
  Search,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { GpCalculator } from "@/components/stock/gp-calculator"
import { ProductDialog } from "@/components/stock/product-dialog"
import { OrderDialog } from "@/components/stock/order-dialog"
import { SupplierDialog } from "@/components/stock/supplier-dialog"
import { StockTake } from "@/components/stock/stock-take"
import { StockAnalyticsView } from "@/components/stock/stock-analytics"
import {
  deleteProduct,
  deleteStockOrder,
  deleteStockSupplier,
  updateStockOrderStatus,
  type StockAnalytics as StockAnalyticsData,
} from "@/app/actions/stock"
import { computeGp, ORDER_STATUSES, poundsFromPence } from "@/lib/stock"
import type {
  DbOrder,
  DbStockCount,
  DbStockProduct,
  DbSupplier,
} from "@/lib/db/schema"

type Tab = "overview" | "products" | "orders" | "suppliers" | "counts" | "gp"

const TABS: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: "overview", label: "Overview", icon: Boxes },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: Truck },
  { id: "suppliers", label: "Suppliers", icon: Building2 },
  { id: "counts", label: "Stock takes", icon: ClipboardList },
  { id: "gp", label: "GP calculator", icon: TrendingUp },
]

export function StockView({
  venueId,
  canManageProducts,
  products,
  suppliers,
  orders,
  counts,
  analytics,
}: {
  venueId: number
  canManageProducts: boolean
  products: DbStockProduct[]
  suppliers: DbSupplier[]
  orders: DbOrder[]
  counts: DbStockCount[]
  analytics: StockAnalyticsData
}) {
  const [tab, setTab] = useState<Tab>("overview")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock management"
        description="Products, purchase orders, stock takes and gross profit — all in one place."
      />

      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {tab === "overview" && <StockAnalyticsView analytics={analytics} />}
      {tab === "products" && (
        <ProductsTab
          venueId={venueId}
          canManageProducts={canManageProducts}
          products={products}
          suppliers={suppliers}
        />
      )}
      {tab === "orders" && (
        <OrdersTab venueId={venueId} orders={orders} products={products} suppliers={suppliers} />
      )}
      {tab === "suppliers" && <SuppliersTab venueId={venueId} suppliers={suppliers} />}
      {tab === "counts" && <StockTake venueId={venueId} counts={counts} />}
      {tab === "gp" && <GpCalculator products={products} />}
    </div>
  )
}

/* ------------------------------- Products tab ------------------------------ */

function ProductsTab({
  venueId,
  canManageProducts,
  products,
  suppliers,
}: {
  venueId: number
  canManageProducts: boolean
  products: DbStockProduct[]
  suppliers: DbSupplier[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<DbStockProduct | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    )
  }, [products, query])

  async function handleDelete(id: number) {
    await deleteProduct(id)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Package className="size-5" /> Products
          <Badge variant="secondary">{products.length}</Badge>
        </CardTitle>
        {canManageProducts ? (
          <ProductDialog venueId={venueId} suppliers={suppliers} />
        ) : (
          <p className="text-xs text-muted-foreground">Only the account owner can add products.</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, SKU or category"
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {products.length === 0
              ? "No products yet. Add your first product to get started."
              : "No products match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">Category</th>
                  <th className="px-2 py-2 text-right font-medium">On hand</th>
                  <th className="px-2 py-2 text-right font-medium">Cost</th>
                  <th className="px-2 py-2 text-right font-medium">Sale</th>
                  <th className="px-2 py-2 text-right font-medium">GP%</th>
                  {canManageProducts && <th className="w-10 px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const gp = computeGp(p.costPricePence, p.salePricePence, p.vatRatePct)
                  const low = p.onHandQty <= p.parLevel && p.parLevel > 0
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-2 py-2.5">
                        <div className="font-medium">{p.name}</div>
                        {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{p.category}</td>
                      <td className="px-2 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1">
                          {low && <AlertTriangle className="size-3.5 text-destructive" />}
                          {p.onHandQty} {p.unit}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {poundsFromPence(p.costPricePence)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {poundsFromPence(p.salePricePence)}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <Badge
                          variant={
                            p.salePricePence === 0
                              ? "secondary"
                              : gp.marginPct >= 65
                                ? "default"
                                : gp.marginPct >= 50
                                  ? "secondary"
                                  : "destructive"
                          }
                        >
                          {p.salePricePence === 0 ? "—" : `${gp.marginPct.toFixed(0)}%`}
                        </Badge>
                      </td>
                      {canManageProducts && (
                        <td className="px-2 py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreVertical className="size-4" />
                                  <span className="sr-only">Product actions</span>
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing(p)}>
                                <Pencil className="size-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(p.id)}>
                                <Trash2 className="size-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editing && (
        <ProductDialog
          venueId={venueId}
          suppliers={suppliers}
          product={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </Card>
  )
}

/* -------------------------------- Orders tab ------------------------------- */

function OrdersTab({
  venueId,
  orders,
  products,
  suppliers,
}: {
  venueId: number
  orders: DbOrder[]
  products: DbStockProduct[]
  suppliers: DbSupplier[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function handleDelete(id: number) {
    await deleteStockOrder(id)
    router.refresh()
  }

  async function handleStatus(id: number, status: string) {
    setBusyId(id)
    try {
      await updateStockOrderStatus(id, status)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-5" /> Purchase orders
          <Badge variant="secondary">{orders.length}</Badge>
        </CardTitle>
        <OrderDialog venueId={venueId} products={products} suppliers={suppliers} />
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No orders yet. Create an order and pick products like a shopping list.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{o.reference}</span>
                    <Badge variant={o.status === "Delivered" ? "default" : "secondary"}>{o.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {o.supplier} · {o.items} item{o.items === 1 ? "" : "s"}
                    {o.due && o.due !== "—" ? ` · due ${o.due}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{poundsFromPence(o.totalPence)}</span>
                  <Select
                    value={o.status}
                    onValueChange={(v) => handleStatus(o.id, v)}
                    disabled={busyId === o.id}
                  >
                    <SelectTrigger size="sm" className="w-36" aria-label={`Status for ${o.reference}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Order actions</span>
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(o.id)}>
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Marking an order “Delivered” automatically receives its items into stock.
        </p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Suppliers tab ------------------------------ */

function SuppliersTab({ venueId, suppliers }: { venueId: number; suppliers: DbSupplier[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<DbSupplier | null>(null)

  async function handleDelete(id: number) {
    await deleteStockSupplier(id)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5" /> Suppliers
          <Badge variant="secondary">{suppliers.length}</Badge>
        </CardTitle>
        <SupplierDialog venueId={venueId} />
      </CardHeader>
      <CardContent>
        {suppliers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No suppliers yet. Add the suppliers you buy stock from to build orders faster.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <span className="font-medium">{s.name}</span>
                  <p className="text-sm text-muted-foreground">
                    {s.category || "Uncategorised"} · {s.terms}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreVertical className="size-4" />
                        <span className="sr-only">Supplier actions</span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(s)}>
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editing && (
        <SupplierDialog
          venueId={venueId}
          supplier={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </Card>
  )
}
