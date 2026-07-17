"use client"

import { AlertTriangle, Boxes, PoundSterling, Percent, TrendingUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { poundsFromPence } from "@/lib/stock"
import type { StockAnalytics } from "@/app/actions/stock"

export function StockAnalyticsView({ analytics }: { analytics: StockAnalytics }) {
  const {
    productCount,
    stockValuePence,
    retailValuePence,
    potentialProfitPence,
    avgMarginPct,
    belowParCount,
    categories,
    topValue,
    lastVariancePence,
  } = analytics

  const maxCat = Math.max(1, ...categories.map((c) => c.valuePence))
  const maxTop = Math.max(1, ...topValue.map((t) => t.valuePence))

  const stats = [
    { label: "Stock value (at cost)", value: poundsFromPence(stockValuePence), icon: PoundSterling },
    { label: "Retail value", value: poundsFromPence(retailValuePence), icon: TrendingUp },
    { label: "Potential profit", value: poundsFromPence(potentialProfitPence), icon: Percent },
    { label: "Avg GP margin", value: `${avgMarginPct.toFixed(1)}%`, icon: Percent },
    { label: "Products", value: String(productCount), icon: Boxes },
    { label: "Below par", value: String(belowParCount), icon: AlertTriangle, alert: belowParCount > 0 },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="gap-0 p-4">
              <Icon className={`size-4 ${s.alert ? "text-destructive" : "text-muted-foreground"}`} />
              <p
                className={`mt-2 text-xl font-semibold tabular-nums ${s.alert ? "text-destructive" : "text-foreground"}`}
              >
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          )
        })}
      </div>

      {lastVariancePence !== null && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Last stock take variance</p>
              <p className="text-xs text-muted-foreground">
                Difference between counted and expected value on your most recent completed count.
              </p>
            </div>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                lastVariancePence < 0 ? "text-destructive" : "text-primary"
              }`}
            >
              {lastVariancePence > 0 ? "+" : ""}
              {poundsFromPence(lastVariancePence)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock value by category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            ) : (
              categories.map((c) => (
                <div key={c.category} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{c.category}</span>
                    <span className="tabular-nums text-muted-foreground">{poundsFromPence(c.valuePence)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(c.valuePence / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highest value lines</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {topValue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            ) : (
              topValue.map((t) => (
                <div key={t.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{t.name}</span>
                    <span className="tabular-nums text-muted-foreground">{poundsFromPence(t.valuePence)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-chart-4"
                      style={{ width: `${(t.valuePence / maxTop) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
