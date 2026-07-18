"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { csvCell } from "@/lib/rota"
import type { GroupAssetLine } from "@/app/actions/group"

/**
 * Exports the group fixed-asset register as a balance-sheet style CSV: assets
 * grouped by venue with per-venue subtotals, a category summary and a group
 * total, ready to drop into accounting software or a fixed-asset schedule.
 */
export function AssetBalanceExport({
  lines,
  categoryTotals,
  totalValue,
  totalCount,
}: {
  lines: GroupAssetLine[]
  categoryTotals: { category: string; value: number; count: number }[]
  totalValue: number
  totalCount: number
}) {
  function exportCsv() {
    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    const rows: string[] = []
    rows.push(["Beeserv — Group Fixed Asset Register"].map(csvCell).join(","))
    rows.push([`Generated ${today}`].map(csvCell).join(","))
    rows.push("")

    // Assets grouped by venue with a subtotal after each group.
    const header = ["Venue", "Asset no.", "Name", "Category", "Condition", "Purchase date", "Value (£)"]
    rows.push(header.map(csvCell).join(","))

    const byVenue = new Map<string, GroupAssetLine[]>()
    for (const l of lines) {
      const list = byVenue.get(l.venue) ?? []
      list.push(l)
      byVenue.set(l.venue, list)
    }
    for (const [venue, venueLines] of byVenue) {
      for (const l of venueLines) {
        rows.push(
          [l.venue, l.assetNumber, l.name, l.category, l.condition, l.purchaseDate, l.price.toFixed(2)]
            .map(csvCell)
            .join(","),
        )
      }
      const subtotal = venueLines.reduce((s, l) => s + l.price, 0)
      rows.push(["", "", "", "", "", `${venue} subtotal`, subtotal.toFixed(2)].map(csvCell).join(","))
      rows.push("")
    }

    // Category summary.
    rows.push(["Category summary"].map(csvCell).join(","))
    rows.push(["Category", "Count", "Value (£)"].map(csvCell).join(","))
    for (const c of categoryTotals) {
      rows.push([c.category, c.count, c.value.toFixed(2)].map(csvCell).join(","))
    }
    rows.push("")
    rows.push(["Total fixed assets", totalCount, totalValue.toFixed(2)].map(csvCell).join(","))

    const csv = rows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `group-asset-balance-sheet-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button onClick={exportCsv} className="gap-2" disabled={totalCount === 0}>
      <Download className="size-4" />
      Export balance sheet
    </Button>
  )
}
