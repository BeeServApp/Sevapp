"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Boxes,
  Package,
  ShoppingCart,
  ClipboardList,
  Calculator,
  BarChart3,
  Search,
  Pencil,
  Trash2,
  MoreVertical,
  AlertTriangle,
  Truck,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ProductDialog } from "@/components/stock/product-dialog"
import { OrderDialog } from "@/components/stock/order-dialog"
import { StockTake } from "@/components/stock/stock-take"
import { StockAnalyticsView } from "@/components/stock/stock-analytics"
import { GpCalculator } from "@/components/stock/gp-calculator"

import {
  deleteProduct,
  deleteStockOrder,
  updateStockOrderStatus,
  type StockAnalytics,
} from "@/app/actions/stock"
import { computeGp, poundsFromPence, ORDER_STATUSES } from "@/lib/stock"
import type {
  DbStockProduct,
  DbSupplier,
  DbOrder,
  DbStockCount,
} from "@/lib/db/schema"

interface StockViewProps {
  venueId: number
  canManageProducts: boolean
  products: DbStockProduct[]
  suppliers: DbSupplier[]
  orders: DbOrder[]
  counts: DbStockCount[]
  analytics: StockAnalytics
}

export function StockView({
  venueId,
  canManageProducts,
  products,
  suppliers,
  orders,
  counts,
  analytics,
}: StockViewProps) {
  const router = useRouter()
  const [tab, setTab] = useState("products")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [editing, setEditing] = useState<DbStockProduct | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<DbStockProduct | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<DbOrder | null>(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) set.add(p.category)
    return ["all", ...[...set].sort()]
  }, [products])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      )
    })
  }, [products, query, category])

  async function handleDeleteProduct() {
    if (!deletingProduct) return
    await deleteProduct(deletingProduct.id)
    setDeletingProduct(null)
    router.refresh()
  }

  async function handleDeleteOrder() {
    if (!deletingOrder) return
    await deleteStockOrder(deletingOrder.id)
    setDeletingOrder(null)
    router.refresh()
  }

  async function handleOrderStatus(id: number, status: string) {
    await updateStockOrderStatus(id, status)
    router.refresh()
  }

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Products, purchase orders, stock takes and profitability for this venue."
        actions={
          <>
            {canManageProducts && (
              <ProductDialog venueId={venueId} suppliers={suppliers} />
            )}
            <OrderDialog venueId={venueId} products={products} suppliers={suppliers} />
          </>
        }
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={<Package className="h-4 w-4" />}
          label="Products"
          value={String(analytics.productCount)}
        />
        <SummaryCard
          icon={<Boxes className="h-4 w-4" />}
          label="Stock value"
          value={poundsFromPence(analytics.stockValuePence)}
        />
        <SummaryCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Avg GP margin"
          value={`${analytics.avgMarginPct.toFixed(1)}%`}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Below par"
          value={String(analytics.belowParCount)}
          highlight={analytics.belowParCount > 0}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex w-full flex-wrap justify-start">
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-4 w-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" /> Orders
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5">
            <Truck className="h-4 w-4" /> Suppliers
          </TabsTrigger>
          <TabsTrigger value="counts" className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Stock take
          </TabsTrigger>
          <TabsTrigger value="gp" className="gap-1.5">
            <Calculator className="h-4 w-4" /> GP calculator
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* Products */}
        <TabsContent value="products">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, SKU or barcode"
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "all" ? "All categories" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No products yet"
              description={
                canManageProducts
                  ? "Create your first product to start tracking stock and margins."
                  : "No products have been set up for this venue yet."
              }
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Sale</TableHead>
                      <TableHead className="text-right">GP%</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const gp = computeGp(p.costPricePence, p.salePricePence, p.vatRatePct)
                      const belowPar = (p.onHandQty ?? 0) < (p.parLevel ?? 0)
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{p.name}</div>
                            {p.sku && (
                              <div className="text-xs text-muted-foreground">{p.sku}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{p.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={belowPar ? "font-semibold text-destructive" : ""}>
                              {formatQty(p.onHandQty)} {p.unit}
                            </span>
                            {belowPar && (
                              <div className="text-xs text-muted-foreground">
                                par {formatQty(p.parLevel)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {poundsFromPence(p.costPricePence)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {poundsFromPence(p.salePricePence)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span
                              className={
                                gp.marginPct >= 65
                                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                                  : gp.marginPct < 50
                                    ? "font-medium text-destructive"
                                    : ""
                              }
                            >
                              {gp.marginPct.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {canManageProducts && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditing(p)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeletingProduct(p)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders">
          {orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title="No orders yet"
              description="Create a purchase order by picking products like a shopping list."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium text-foreground">
                          {o.reference}
                        </TableCell>
                        <TableCell>{o.supplier}</TableCell>
                        <TableCell className="text-right tabular-nums">{o.items}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {poundsFromPence(o.totalPence)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={o.status}
                            onValueChange={(v) => handleOrderStatus(o.id, v)}
                          >
                            <SelectTrigger className="h-8 w-36">
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
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeletingOrder(o)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Marking an order as <strong>Delivered</strong> receives the ordered quantities into stock automatically.
          </p>
        </TabsContent>

        {/* Suppliers */}
        <TabsContent value="suppliers">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="No suppliers yet"
              description="Suppliers you add when creating products and orders will appear here."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suppliers.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{s.name}</span>
                      </div>
                      {s.category && <Badge variant="secondary">{s.category}</Badge>}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Terms: {s.terms}</p>
                    <p className="text-sm text-muted-foreground">
                      Spend MTD: {poundsFromPence(s.spendMtdPence)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Stock take */}
        <TabsContent value="counts">
          <StockTake venueId={venueId} counts={counts} />
        </TabsContent>

        {/* GP calculator */}
        <TabsContent value="gp">
          <GpCalculator products={products} />
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <StockAnalyticsView analytics={analytics} />
        </TabsContent>
      </Tabs>

      {/* Edit product dialog (owner only) */}
      {canManageProducts && editing && (
        <ProductDialog
          venueId={venueId}
          suppliers={suppliers}
          product={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      {/* Delete product confirm */}
      <AlertDialog
        open={!!deletingProduct}
        onOpenChange={(o) => !o && setDeletingProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingProduct?.name} will be removed from the catalogue. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete order confirm */}
      <AlertDialog open={!!deletingOrder} onOpenChange={(o) => !o && setDeletingOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order?</AlertDialogTitle>
            <AlertDialogDescription>
              Order {deletingOrder?.reference} and its lines will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p
          className={
            "mt-2 text-2xl font-semibold tabular-nums " +
            (highlight ? "text-destructive" : "text-foreground")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
