import type { Metadata } from "next"
import Link from "next/link"
import { Boxes, PoundSterling, TrendingUp, AlertTriangle, ArrowLeft, ArrowRightLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { guardOwnerPage } from "@/lib/session"
import { getVenues } from "@/app/actions/venues"
import { getGroupStockSummary } from "@/app/actions/group"
import { getProducts, getStockTransfers } from "@/app/actions/stock"
import { StockTransferPanel } from "@/components/group/stock-transfer-panel"
import { gbp0 } from "@/lib/finance"

export const metadata: Metadata = {
  title: "Group stock — Beeserv",
}

export default async function GroupStockPage() {
  await guardOwnerPage()
  const [summary, venues, transfers] = await Promise.all([
    getGroupStockSummary(),
    getVenues(),
    getStockTransfers(),
  ])

  // All products across venues power the transfer picker.
  const productsByVenue = await Promise.all(venues.map((v) => getProducts(v.id)))
  const products = productsByVenue.flat().map((p) => ({
    id: p.id,
    name: p.name,
    venueId: p.venueId,
    onHandQty: p.onHandQty ?? 0,
    unit: p.unit ?? "each",
  }))
  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }))
  const venueName = new Map(venues.map((v) => [v.id, v.name]))

  const stats = [
    { label: "Group stock value", value: gbp0.format(summary.stockValuePence / 100), icon: PoundSterling },
    { label: "Retail value", value: gbp0.format(summary.retailValuePence / 100), icon: TrendingUp },
    { label: "Products", value: String(summary.productCount), icon: Boxes },
    {
      label: "Below par",
      value: String(summary.belowParCount),
      icon: AlertTriangle,
      tone: summary.belowParCount > 0 ? "text-destructive" : "text-foreground",
    },
  ]

  return (
    <>
      <PageHeader
        title="Group stock"
        description="Combined stock value across venues, with inter-venue transfers."
        actions={<StockTransferPanel venues={venueOptions} products={products} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="gap-0 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
              </div>
              <p
                className={cn(
                  "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
                  s.tone ?? "text-foreground",
                )}
              >
                {s.value}
              </p>
            </Card>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stock value by venue</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Valued at cost, with items below par level</p>
          </CardHeader>
          <CardContent>
            {summary.venues.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No venues yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-medium">Venue</th>
                      <th className="pb-2 text-right font-medium">Products</th>
                      <th className="pb-2 text-right font-medium">Stock value</th>
                      <th className="pb-2 text-right font-medium">Below par</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.venues.map((v) => (
                      <tr key={v.venueId} className="hover:bg-secondary/50">
                        <td className="py-3">
                          <p className="font-medium text-foreground">{v.name}</p>
                          <p className="text-xs text-muted-foreground">{v.location}</p>
                        </td>
                        <td className="py-3 text-right tabular-nums text-muted-foreground">
                          {v.productCount}
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums text-foreground">
                          {gbp0.format(v.stockValuePence / 100)}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          <span className={v.belowParCount > 0 ? "text-destructive" : "text-muted-foreground"}>
                            {v.belowParCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-4 text-primary" /> Recent transfers
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Latest inter-venue stock moves</p>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No transfers yet. Use “Transfer stock” to move items between venues.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {transfers.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{t.productName}</span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {t.qty}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {venueName.get(t.fromVenueId) ?? "—"} → {venueName.get(t.toVenueId) ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-center">
        <Link
          href="/stock"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}
        >
          <ArrowLeft className="size-4" /> Back to venue stock
        </Link>
      </div>
    </>
  )
}
