"use client"

import { useMemo, useState } from "react"
import { Calculator, Target } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { computeGp, penceFromPounds, poundsFromPence, salePenceForTargetMargin } from "@/lib/stock"
import type { DbStockProduct } from "@/lib/db/schema"

const VAT_RATES = ["0", "5", "20"]

/**
 * A standalone Gross Profit Margin calculator. Works on ex-VAT figures (UK
 * hospitality standard): enter a cost and net sale price to see profit, GP% and
 * markup, or set a target GP% to get the sale price you should charge. You can
 * also pre-fill it from an existing product.
 */
export function GpCalculator({ products }: { products: DbStockProduct[] }) {
  const [cost, setCost] = useState("1.20")
  const [sale, setSale] = useState("4.50")
  const [vat, setVat] = useState("20")
  const [target, setTarget] = useState("70")

  const costPence = penceFromPounds(cost)
  const salePence = penceFromPounds(sale)
  const vatRate = Number.parseInt(vat, 10) || 0
  const gp = useMemo(() => computeGp(costPence, salePence, vatRate), [costPence, salePence, vatRate])

  const targetPct = Number.parseFloat(target) || 0
  const suggestedNet = salePenceForTargetMargin(costPence, targetPct)
  const suggestedGross = Math.round(suggestedNet * (1 + vatRate / 100))

  function loadProduct(id: string) {
    const p = products.find((x) => String(x.id) === id)
    if (!p) return
    setCost((p.costPricePence / 100).toFixed(2))
    setSale((p.salePricePence / 100).toFixed(2))
    setVat(String(p.vatRatePct))
  }

  const marginColor =
    gp.marginPct >= 70 ? "text-primary" : gp.marginPct >= 50 ? "text-chart-4" : "text-destructive"

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4 text-primary" /> Gross profit calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {products.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Pre-fill from a product</Label>
              <Select onValueChange={loadProduct}>
                <SelectTrigger aria-label="Pick a product to pre-fill">
                  <SelectValue placeholder="Choose a product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gp-cost">Cost price (ex-VAT)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  £
                </span>
                <Input
                  id="gp-cost"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="pl-6"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gp-sale">Sale price (ex-VAT)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  £
                </span>
                <Input
                  id="gp-sale"
                  inputMode="decimal"
                  value={sale}
                  onChange={(e) => setSale(e.target.value)}
                  className="pl-6"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>VAT rate</Label>
            <Select value={vat} onValueChange={setVat}>
              <SelectTrigger aria-label="VAT rate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_RATES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-6">
            <Metric label="Gross profit / unit" value={poundsFromPence(gp.profitPence)} />
            <Metric label="GP margin" value={`${gp.marginPct.toFixed(1)}%`} valueClass={marginColor} />
            <Metric label="Markup" value={`${gp.markupPct.toFixed(0)}%`} />
            <Metric label="Sale inc. VAT" value={poundsFromPence(gp.grossSalePence)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" /> Price for a target GP
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="gp-target">Target GP margin (%)</Label>
                <Input
                  id="gp-target"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSale((suggestedNet / 100).toFixed(2))}
              >
                Apply
              </Button>
            </div>
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-sm text-muted-foreground">
                To hit <span className="font-medium text-foreground">{targetPct.toFixed(0)}%</span> GP on a
                cost of <span className="font-medium text-foreground">{poundsFromPence(costPence)}</span>,
                charge:
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {poundsFromPence(suggestedNet)}{" "}
                <span className="text-sm font-normal text-muted-foreground">ex-VAT</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {poundsFromPence(suggestedGross)} inc. VAT
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}
