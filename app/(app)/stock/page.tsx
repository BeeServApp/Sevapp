import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { StockView } from "@/components/stock/stock-view"
import { getActiveVenueId, getSession, guardManagerPage } from "@/lib/session"
import { guardModuleAccess } from "@/lib/plan-guard"
import {
  getProducts,
  getStockAnalytics,
  getStockCounts,
  getStockOrders,
  getStockSuppliers,
} from "@/app/actions/stock"

export const metadata: Metadata = {
  title: "Stock — Beeserv",
}

export default async function StockPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  const me = await guardManagerPage()
  await guardModuleAccess("/stock")

  const venueId = await getActiveVenueId(me.accountId)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start managing stock.
      </p>
    )
  }

  const [products, suppliers, orders, counts, analytics] = await Promise.all([
    getProducts(venueId),
    getStockSuppliers(venueId),
    getStockOrders(venueId),
    getStockCounts(venueId),
    getStockAnalytics(venueId),
  ])

  return (
    <StockView
      venueId={venueId}
      canManageProducts={me.appRole === "owner"}
      products={products}
      suppliers={suppliers}
      orders={orders}
      counts={counts}
      analytics={analytics}
    />
  )
}
