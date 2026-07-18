import type { Metadata } from "next"
import Link from "next/link"
import { Package, Building2, Layers, PoundSterling, ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { guardOwnerPage } from "@/lib/session"
import { getGroupAssetSummary } from "@/app/actions/group"
import { AssetBalanceExport } from "@/components/group/asset-balance-export"

export const metadata: Metadata = {
  title: "Group assets — Beeserv",
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
})

export default async function GroupAssetsPage() {
  await guardOwnerPage()
  const summary = await getGroupAssetSummary()

  const stats = [
    { label: "Group asset value", value: gbp.format(summary.totalValue), icon: PoundSterling },
    { label: "Assets tracked", value: String(summary.totalCount), icon: Package },
    { label: "Venues", value: String(summary.venues.length), icon: Building2 },
    { label: "Categories", value: String(summary.categoryTotals.length), icon: Layers },
  ]

  const topCatValue = summary.categoryTotals[0]?.value ?? 0

  return (
    <>
      <PageHeader
        title="Group assets"
        description="Combined fixed-asset register across every venue."
        actions={
          <AssetBalanceExport
            lines={summary.lines}
            categoryTotals={summary.categoryTotals}
            totalValue={summary.totalValue}
            totalCount={summary.totalCount}
          />
        }
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
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                {s.value}
              </p>
            </Card>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Asset value by venue</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Active (non-disposed) assets, valued at purchase cost
            </p>
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
                      <th className="pb-2 text-right font-medium">Assets</th>
                      <th className="pb-2 text-right font-medium">Value</th>
                      <th className="pb-2 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.venues.map((v) => {
                      const share =
                        summary.totalValue > 0 ? (v.totalValue / summary.totalValue) * 100 : 0
                      return (
                        <tr key={v.venueId} className="hover:bg-secondary/50">
                          <td className="py-3">
                            <p className="font-medium text-foreground">{v.name}</p>
                            <p className="text-xs text-muted-foreground">{v.location}</p>
                          </td>
                          <td className="py-3 text-right tabular-nums text-muted-foreground">
                            {v.assetCount}
                          </td>
                          <td className="py-3 text-right font-medium tabular-nums text-foreground">
                            {gbp.format(v.totalValue)}
                          </td>
                          <td className="py-3 text-right tabular-nums text-muted-foreground">
                            {share.toFixed(0)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Group-wide value split</p>
          </CardHeader>
          <CardContent>
            {summary.categoryTotals.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No assets yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {summary.categoryTotals.map((c) => (
                  <li key={c.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{c.category}</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {gbp.format(c.value)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${topCatValue > 0 ? (c.value / topCatValue) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {c.count} asset{c.count === 1 ? "" : "s"}
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
          href="/assets"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}
        >
          <ArrowLeft className="size-4" /> Back to venue assets
        </Link>
      </div>
    </>
  )
}
