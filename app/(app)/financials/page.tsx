import { Download, TrendingUp, TrendingDown, Lightbulb } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ProfitChart, ExpenseChart } from "@/components/charts"
import { FinancialsExpenses } from "@/components/financials-view"
import { financialKpis, expenseBreakdown } from "@/lib/mock-data"
import { getUserId, getActiveVenueId } from "@/lib/session"
import { getExpenses } from "@/app/actions/financials"

const targets = [
  { label: "Wet sales", current: 24500, target: 26000 },
  { label: "Food sales", current: 13100, target: 14000 },
  { label: "Events", current: 3000, target: 2500 },
  { label: "Total revenue", current: 182400, target: 193000 },
]

const insights = [
  { tone: "up", text: "Wet GP is 1.1pt above target — strong margin on draught lines." },
  { tone: "down", text: "Utilities up 4% vs last month; review off-peak energy usage." },
  { tone: "up", text: "Food waste down to 3.2% after new prep schedule." },
  { tone: "down", text: "1 invoice overdue (£320) — AceCool Ltd maintenance." },
]

export default async function FinancialsPage() {
  const userId = await getUserId()
  const venueId = await getActiveVenueId(userId)
  const expenses = venueId ? await getExpenses(venueId) : []

  return (
    <>
      <PageHeader
        title="Financials"
        description="P&L tracking, revenue targets, expenses and real-time spending insights."
        actions={
          <Button variant="outline" className="gap-1.5">
            <Download className="size-4" /> Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {financialKpis.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profit &amp; loss</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Revenue vs costs, last 6 months</p>
          </CardHeader>
          <CardContent>
            <ProfitChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense breakdown</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Share of total spend</p>
          </CardHeader>
          <CardContent>
            <ExpenseChart />
            <ul className="mt-2 flex flex-col gap-2">
              {expenseBreakdown.map((e) => (
                <li key={e.category} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: e.fill }} />
                  <span className="text-muted-foreground">{e.category}</span>
                  <span className="ml-auto font-medium text-foreground">{e.value}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Revenue targets</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Month to date</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {targets.map((t) => {
              const pct = Math.min(Math.round((t.current / t.target) * 100), 100)
              return (
                <div key={t.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{t.label}</span>
                    <span className="text-muted-foreground">
                      £{t.current.toLocaleString()} / £{t.target.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending insights</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {insights.map((ins, i) => {
              const Icon = ins.tone === "up" ? TrendingUp : TrendingDown
              return (
                <div key={i} className="flex gap-3">
                  <div
                    className={
                      ins.tone === "up"
                        ? "flex size-7 shrink-0 items-center justify-center rounded-md bg-chart-2/15 text-chart-2"
                        : "flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/12 text-destructive"
                    }
                  >
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm text-foreground">{ins.text}</p>
                </div>
              )
            })}
            <div className="mt-1 flex items-center gap-2 rounded-md bg-accent/50 p-3 text-sm text-accent-foreground">
              <Lightbulb className="size-4 shrink-0 text-primary" />
              Net margin trending up 0.8pt this quarter.
            </div>
          </CardContent>
        </Card>

        {venueId ? (
          <FinancialsExpenses venueId={venueId} initialExpenses={expenses} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Recent expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Create a venue to track expenses.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
