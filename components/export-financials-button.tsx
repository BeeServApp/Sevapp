"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface FinancialsReport {
  venueName: string
  periodLabel: string
  kpis: { label: string; value: string; detail: string }[]
  targets: { label: string; actual: string; target: string; status: string }[]
  pl: { month: string; revenue: string; costs: string; profit: string }[]
  expenseMix: { category: string; share: string }[]
  expenses: { category: string; vendor: string; date: string; amount: string; status: string }[]
  insights: string[]
}

interface Props {
  report: FinancialsReport
}

export function ExportFinancialsButton({ report }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ unit: "pt", format: "a4" })
      const pageWidth = doc.internal.pageSize.getWidth()
      const marginX = 40
      const brand: [number, number, number] = [23, 23, 23]
      const muted: [number, number, number] = [115, 115, 115]

      // Header
      doc.setFont("helvetica", "bold")
      doc.setFontSize(20)
      doc.setTextColor(...brand)
      doc.text("Financial Report", marginX, 54)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.setTextColor(...muted)
      doc.text(report.venueName, marginX, 72)

      const generated = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      doc.text(report.periodLabel, pageWidth - marginX, 54, { align: "right" })
      doc.text(`Generated ${generated}`, pageWidth - marginX, 72, { align: "right" })

      doc.setDrawColor(229, 229, 229)
      doc.line(marginX, 86, pageWidth - marginX, 86)

      let y = 108

      const sectionTitle = (title: string) => {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(13)
        doc.setTextColor(...brand)
        doc.text(title, marginX, y)
        y += 8
      }

      // KPI summary
      sectionTitle("Summary")
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value", "Detail"]],
        body: report.kpis.map((k) => [k.label, k.value, k.detail]),
        theme: "grid",
        margin: { left: marginX, right: marginX },
        headStyles: { fillColor: brand, halign: "left" },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: { 1: { fontStyle: "bold" } },
      })
      y = (doc as any).lastAutoTable.finalY + 24

      // Targets
      if (report.targets.length > 0) {
        sectionTitle("Performance targets")
        autoTable(doc, {
          startY: y,
          head: [["Target", "Actual", "Goal", "Status"]],
          body: report.targets.map((t) => [t.label, t.actual, t.target, t.status]),
          theme: "grid",
          margin: { left: marginX, right: marginX },
          headStyles: { fillColor: brand, halign: "left" },
          styles: { fontSize: 10, cellPadding: 6 },
        })
        y = (doc as any).lastAutoTable.finalY + 24
      }

      // P&L
      if (report.pl.length > 0) {
        sectionTitle("Profit & loss (last 6 months)")
        autoTable(doc, {
          startY: y,
          head: [["Month", "Revenue", "Costs", "Net profit"]],
          body: report.pl.map((p) => [p.month, p.revenue, p.costs, p.profit]),
          theme: "grid",
          margin: { left: marginX, right: marginX },
          headStyles: { fillColor: brand, halign: "left" },
          styles: { fontSize: 10, cellPadding: 6 },
          columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
        })
        y = (doc as any).lastAutoTable.finalY + 24
      }

      // Expense breakdown
      if (report.expenseMix.length > 0) {
        sectionTitle("Expense breakdown")
        autoTable(doc, {
          startY: y,
          head: [["Category", "Share of spend"]],
          body: report.expenseMix.map((e) => [e.category, e.share]),
          theme: "grid",
          margin: { left: marginX, right: marginX },
          headStyles: { fillColor: brand, halign: "left" },
          styles: { fontSize: 10, cellPadding: 6 },
          columnStyles: { 1: { halign: "right" } },
        })
        y = (doc as any).lastAutoTable.finalY + 24
      }

      // Expenses detail
      if (report.expenses.length > 0) {
        sectionTitle("Recent expenses")
        autoTable(doc, {
          startY: y,
          head: [["Category", "Vendor", "Date", "Amount", "Status"]],
          body: report.expenses.map((e) => [e.category, e.vendor, e.date, e.amount, e.status]),
          theme: "grid",
          margin: { left: marginX, right: marginX },
          headStyles: { fillColor: brand, halign: "left" },
          styles: { fontSize: 10, cellPadding: 6 },
          columnStyles: { 3: { halign: "right" } },
        })
        y = (doc as any).lastAutoTable.finalY + 24
      }

      // Insights
      if (report.insights.length > 0) {
        sectionTitle("Spending insights")
        y += 6
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.setTextColor(...brand)
        for (const line of report.insights) {
          const wrapped = doc.splitTextToSize(`•  ${line}`, pageWidth - marginX * 2)
          if (y > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage()
            y = 54
          }
          doc.text(wrapped, marginX, y)
          y += wrapped.length * 14 + 4
        }
      }

      const safeName = report.venueName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
      const stamp = new Date().toISOString().slice(0, 10)
      doc.save(`financial-report-${safeName}-${stamp}.pdf`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={busy}>
      <Download className="size-4" /> {busy ? "Exporting…" : "Export"}
    </Button>
  )
}
