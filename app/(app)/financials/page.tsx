import { Download, TrendingUp, TrendingDown, Lightbulb } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfitChart, ExpenseChart } from "@/components/charts"
import { FinancialsExpenses } from "@/components/financials-view"
import { GamingMachines } from "@/components/gaming/gaming-machines"
import { TakingsLog } from "@/components/takings-log"
import type { Kpi } from "@/lib/mock-data"
import { getUserId, getActiveVenueId, guardOwnerPage } from "@/lib/session"
import { getExpenses } from "@/app/actions/financials"
import { getTakings } from "@/app/actions/takings"
import { getGamingMachines } from "@/app/actions/gaming"
import { getAssets } from "@/app/actions/assets"
import { getSquareConnection } from "@/app/actions/square"
import { getVenues } from "@/app/actions/venues"
import { getBudget } from "@/app/actions/budget"
import { SquareSyncButton } from "@/components/square-sync-button"
import { SquareBackgroundSync } from "@/components/square-background-sync"
import { BudgetDialog } from "@/components/budget-dialog"
import { TargetStatusDot } from "@/components/target-status-dot"
import { Target } from "lucide-react"
import { evaluateTarget, statusLabel, type TargetStatus } from "@/lib/budget"
import {
  gbp0,
  profitSeries,
  expenseBreakdown as computeExpenseBreakdown,
  revenueByCategoryMTD,
  revenuePenceForMonth,
  revenuePenceForWeek,
  expensePenceForMonth,
  expensePenceForMonthByCategory,
  gamingIncomePenceForMonth,
  thisMonthKey,
  lastMonthKey,
} from "@/lib/finance"

function pctDelta(curr: number, prev: number) {
  if (prev <= 0) return null
  return ((curr - prev) / prev) * 100
}

interface Insight {
  tone: "up" | "down"
  text: string
}

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await guardOwnerPage()
  const { tab } = await searchParams
  const userId = await getUserId()
  const venueId = await getActiveVenueId(userId)

  const squareConn = await getSquareConnection()
  const [expenses, takings, gamingMachines, assets, venues, venueBudget] = venueId
    ? await Promise.all([
        getExpenses(venueId),
        getTakings(venueId),
        getGamingMachines(venueId),
        getAssets(venueId),
        getVenues(),
        getBudget(venueId),
      ])
    : [[], [], [], [], [], null]

  const assetOptions = assets.map((a) => ({ id: a.id, name: a.name }))
  const activeVenue = venues.find((v) => v.id === venueId)

  const mk = thisMonthKey()
  const lmk = lastMonthKey()

  // Sales (takings) vs. gaming machine income — combined for headline figures.
  const gamingEntries = gamingMachines.flatMap((m) => m.entries)
  const machineIncomeMTD = gamingIncomePenceForMonth(gamingEntries, mk)
  const machineIncomeLM = gamingIncomePenceForMonth(gamingEntries, lmk)

  const salesMTD = revenuePenceForMonth(takings, mk)
  const salesLM = revenuePenceForMonth(takings, lmk)
  // Overall revenue includes the venue's share of gaming machine income.
  const revenueMTD = salesMTD + machineIncomeMTD
  const revenueLM = salesLM + machineIncomeLM
  const expensesMTD = expensePenceForMonth(expenses, mk)
  const netProfit = revenueMTD - expensesMTD
  const marginPct = revenueMTD > 0 ? (netProfit / revenueMTD) * 100 : null
  const revDelta = pctDelta(revenueMTD, revenueLM)

  // --- Targets / traffic lights -------------------------------------------
  // GP / labour / sales targets stay measured against sales (takings) only.
  const weekRevenue = revenuePenceForWeek(takings, 0)
  const stockMonth = expensePenceForMonthByCategory(expenses, mk, "Stock")
  const labourMonth = expensePenceForMonthByCategory(expenses, mk, "Staff")
  const gpPct = salesMTD > 0 ? ((salesMTD - stockMonth) / salesMTD) * 100 : null
  const labourPctActual = salesMTD > 0 ? (labourMonth / salesMTD) * 100 : null

  const targetRows: {
    label: string
    actual: string
    target: string
    status: TargetStatus | null
  }[] = [
    {
      label: "Weekly sales",
      actual: takings.length > 0 ? gbp0.format(weekRevenue / 100) : "—",
      target:
        venueBudget?.weeklySalesPence != null
          ? gbp0.format(venueBudget.weeklySalesPence / 100)
          : "Not set",
      status:
        takings.length > 0
          ? evaluateTarget(weekRevenue, venueBudget?.weeklySalesPence, "higher")
          : null,
    },
    {
      label: "Monthly sales",
      actual: takings.length > 0 ? gbp0.format(salesMTD / 100) : "—",
      target:
        venueBudget?.monthlySalesPence != null
          ? gbp0.format(venueBudget.monthlySalesPence / 100)
          : "Not set",
      status:
        takings.length > 0
          ? evaluateTarget(salesMTD, venueBudget?.monthlySalesPence, "higher")
          : null,
    },
    {
      label: "Gross profit",
      actual: gpPct !== null ? `${gpPct.toFixed(1)}%` : "—",
      target: venueBudget?.gpPctTarget != null ? `${venueBudget.gpPctTarget}%` : "Not set",
      status: evaluateTarget(gpPct, venueBudget?.gpPctTarget, "higher"),
    },
    {
      label: "Labour cost",
      actual: labourPctActual !== null ? `${labourPctActual.toFixed(1)}%` : "—",
      target: venueBudget?.labourPctTarget != null ? `${venueBudget.labourPctTarget}%` : "Not set",
      status: evaluateTarget(labourPctActual, venueBudget?.labourPctTarget, "lower"),
    },
  ]

  const monthlySalesStatus =
    takings.length > 0
      ? evaluateTarget(salesMTD, venueBudget?.monthlySalesPence, "higher")
      : null
  const monthlySalesHint =
    venueBudget?.monthlySalesPence != null
      ? `Target ${gbp0.format(venueBudget.monthlySalesPence / 100)}`
      : undefined

  const daysLogged = takings.filter((t) => t.dateISO.slice(0, 7) === mk).length
  const avgDaily = daysLogged > 0 ? salesMTD / daysLogged : 0

  const hasMachineIncome = machineIncomeMTD > 0
  const hasTakings = takings.length > 0
  const hasExpenses = expenses.length > 0
  const hasRevenue = hasTakings || hasMachineIncome
  const hasAny = hasRevenue || hasExpenses

  const kpis: Kpi[] = [
    {
      label: "Revenue (MTD)",
      value: hasRevenue ? gbp0.format(revenueMTD / 100) : "—",
      delta: hasRevenue
        ? revDelta !== null
          ? `${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(1)}%`
          : "New"
        : "No data yet",
      trend: hasRevenue && revDelta !== null ? (revDelta >= 0 ? "up" : "down") : "flat",
      hint: hasMachineIncome ? "incl. machine income" : hasTakings ? "vs last month" : "log takings",
    },
    {
      label: "Net profit (MTD)",
      value: hasAny ? gbp0.format(netProfit / 100) : "—",
      delta: marginPct !== null ? `${marginPct.toFixed(1)}% margin` : "No data yet",
      trend: netProfit >= 0 ? "up" : "down",
      hint: "revenue − expenses",
    },
    {
      label: "Total expenses (MTD)",
      value: hasExpenses ? gbp0.format(expensesMTD / 100) : "—",
      delta: hasExpenses ? `${expenses.length} records` : "No data yet",
      trend: "flat",
      hint: "this month",
    },
    {
      label: "Avg daily takings",
      value: daysLogged > 0 ? gbp0.format(avgDaily / 100) : "—",
      delta: daysLogged > 0 ? `${daysLogged} days logged` : "No data yet",
      trend: "flat",
      hint: "this month",
    },
  ]

  const plData = profitSeries(takings, expenses, 6, gamingEntries)
  const expenseMix = computeExpenseBreakdown(expenses)
  const revByCat = revenueByCategoryMTD(takings)
  const maxCat = Math.max(...revByCat.map((c) => c.pounds), 1)

  // --- Spending insights (derived) ----------------------------------------
  const insights: Insight[] = []
  if (revDelta !== null) {
    insights.push({
      tone: revDelta >= 0 ? "up" : "down",
      text: `Revenue is ${Math.abs(revDelta).toFixed(1)}% ${
        revDelta >= 0 ? "up" : "down"
      } versus last month.`,
    })
  }
  if (hasMachineIncome) {
    const machineShare = revenueMTD > 0 ? (machineIncomeMTD / revenueMTD) * 100 : 0
    insights.push({
      tone: "up",
      text: `Gaming machines contributed ${gbp0.format(machineIncomeMTD / 100)} (${machineShare.toFixed(
        1,
      )}% of revenue) this month.`,
    })
  }
  if (hasExpenses && expenseMix.length > 0) {
    insights.push({
      tone: "down",
      text: `${expenseMix[0].category} is your largest cost at ${expenseMix[0].value}% of spend.`,
    })
  }
  const overdue = expenses.filter((e) => e.status === "Overdue")
  if (overdue.length > 0) {
    const overdueTotal = overdue.reduce((s, e) => s + e.amountPence, 0)
    insights.push({
      tone: "down",
      text: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} totalling ${gbp0.format(
        overdueTotal / 100,
      )}.`,
    })
  }
  if (marginPct !== null) {
    insights.push({
      tone: marginPct >= 0 ? "up" : "down",
      text: `Net margin is running at ${marginPct.toFixed(1)}% this month.`,
    })
  }

  const defaultTab = tab === "gaming" ? "gaming" : "overview"

  return (
    <>
      {venueId && squareConn.connected && (
        <SquareBackgroundSync accountId={userId} venueId={venueId} />
      )}
      <PageHeader
        title="Financials"
        description="P&L tracking, revenue targets, expenses and real-time spending insights."
        actions={
          <div className="flex items-center gap-2">
            {squareConn.connected && <SquareSyncButton scope="active" />}
            {venueId && (
              <BudgetDialog
                venueId={venueId}
                venueName={activeVenue?.name ?? "this venue"}
                budget={venueBudget}
                trigger={
                  <Button variant="outline" className="gap-1.5">
                    <Target className="size-4" /> Set targets
                  </Button>
                }
              />
            )}
            <Button variant="outline" className="gap-1.5">
              <Download className="size-4" /> Export
            </Button>
          </div>
        }
      />

      <Tabs defaultValue={defaultTab} className="mt-2">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gaming">Gaming machines</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <StatCard
                key={kpi.label}
                kpi={kpi}
                status={kpi.label === "Revenue (MTD)" ? monthlySalesStatus : undefined}
                targetHint={kpi.label === "Revenue (MTD)" ? monthlySalesHint : undefined}
              />
            ))}
          </div>

          {venueId && (
            <Card className="mt-4">
              <CardHeader className="flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Target className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Performance targets</CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Traffic lights against your budget
                    </p>
                  </div>
                </div>
                <BudgetDialog
                  venueId={venueId}
                  venueName={activeVenue?.name ?? "this venue"}
                  budget={venueBudget}
                  trigger={
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Edit targets
                    </Button>
                  }
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {targetRows.map((row) => (
                    <div key={row.label} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-muted-foreground">{row.label}</p>
                        {row.status ? <TargetStatusDot status={row.status} /> : null}
                      </div>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                        {row.actual}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.status ? `${statusLabel(row.status)} · ` : ""}Target {row.target}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Profit &amp; loss</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Revenue vs costs, last 6 months</p>
              </CardHeader>
              <CardContent>
                {hasAny ? (
                  <ProfitChart data={plData} />
                ) : (
                  <EmptyBlock body="Log takings and expenses to build your P&L." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense breakdown</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Share of total spend</p>
              </CardHeader>
              <CardContent>
                {hasExpenses ? (
                  <>
                    <ExpenseChart data={expenseMix} />
                    <ul className="mt-2 flex flex-col gap-2">
                      {expenseMix.map((e) => (
                        <li key={e.category} className="flex items-center gap-2 text-sm">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: e.fill }}
                          />
                          <span className="text-muted-foreground">{e.category}</span>
                          <span className="ml-auto font-medium text-foreground">{e.value}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <EmptyBlock body="Add expenses to see your spend breakdown." />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {venueId ? (
              <TakingsLog key={venueId} venueId={venueId} initialTakings={takings} />
            ) : (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Daily takings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Create a venue to record takings.</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Revenue by category</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Month to date</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {hasTakings ? (
                  revByCat.map((c) => (
                    <div key={c.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{c.label}</span>
                        <span className="text-muted-foreground">{gbp0.format(c.pounds)}</span>
                      </div>
                      <Progress value={Math.round((c.pounds / maxCat) * 100)} />
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Log takings to see category revenue.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {venueId ? (
              <FinancialsExpenses key={venueId} venueId={venueId} initialExpenses={expenses} />
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

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Spending insights</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {insights.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Insights appear once you log takings and expenses.
                  </p>
                ) : (
                  <>
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
                      Figures update automatically as you log takings and expenses.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gaming" className="mt-4">
          {venueId ? (
            <GamingMachines
              key={venueId}
              venueId={venueId}
              initialMachines={gamingMachines}
              assets={assetOptions}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Gaming machines</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create a venue to track gaming machines and Machine Games Duty.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

function EmptyBlock({ body }: { body: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-center">
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
