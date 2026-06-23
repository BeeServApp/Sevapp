import { Building2, ArrowRight, ListChecks } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RevenueChart, SalesMixChart } from "@/components/charts"
import { GroupVenueRow } from "@/components/group-venue-row"
import type { Kpi } from "@/lib/mock-data"
import { getUserId, guardOwnerPage } from "@/lib/session"
import { getVenues } from "@/app/actions/venues"
import { getTasks } from "@/app/actions/operations"
import { getTakings } from "@/app/actions/takings"
import { getExpenses } from "@/app/actions/financials"
import {
  gbp0,
  revenueThisWeek,
  salesMix as computeSalesMix,
  revenuePenceForWeek,
  revenuePenceForMonth,
  expensePenceForMonthByCategory,
  thisMonthKey,
} from "@/lib/finance"

function pctDelta(curr: number, prev: number) {
  if (prev <= 0) return null
  return ((curr - prev) / prev) * 100
}

export default async function GroupDashboardPage() {
  await guardOwnerPage()
  const userId = await getUserId()
  const venues = await getVenues()

  // Pull each venue's data in parallel, then aggregate across the group.
  const perVenue = await Promise.all(
    venues.map(async (v) => {
      const [takings, expenses, tasks] = await Promise.all([
        getTakings(v.id),
        getExpenses(v.id),
        getTasks(v.id),
      ])
      return { venue: v, takings, expenses, tasks }
    }),
  )

  const mk = thisMonthKey()
  const allTakings = perVenue.flatMap((d) => d.takings)
  const allExpenses = perVenue.flatMap((d) => d.expenses)
  const allTasks = perVenue.flatMap((d) => d.tasks)
  const hasTakings = allTakings.length > 0

  // --- Combined KPIs -------------------------------------------------------
  const weekRevenue = revenuePenceForWeek(allTakings, 0)
  const prevWeekRevenue = revenuePenceForWeek(allTakings, 7)
  const weekDelta = pctDelta(weekRevenue, prevWeekRevenue)

  const monthRevenue = revenuePenceForMonth(allTakings, mk)
  const stockMonth = expensePenceForMonthByCategory(allExpenses, mk, "Stock")
  const labourMonth = expensePenceForMonthByCategory(allExpenses, mk, "Staff")
  const gpPct = monthRevenue > 0 ? ((monthRevenue - stockMonth) / monthRevenue) * 100 : null
  const labourPct = monthRevenue > 0 ? (labourMonth / monthRevenue) * 100 : null

  const openTasks = allTasks.filter((t) => !t.done)

  const kpis: Kpi[] = [
    {
      label: "Group revenue (wk)",
      value: hasTakings ? gbp0.format(weekRevenue / 100) : "—",
      delta: hasTakings
        ? weekDelta !== null
          ? `${weekDelta >= 0 ? "+" : ""}${weekDelta.toFixed(1)}%`
          : "New"
        : "No data yet",
      trend: hasTakings && weekDelta !== null ? (weekDelta >= 0 ? "up" : "down") : "flat",
      hint: hasTakings ? "vs last week" : "log takings",
    },
    {
      label: "Gross profit",
      value: gpPct !== null ? `${gpPct.toFixed(1)}%` : "—",
      delta: gpPct !== null ? "after stock cost" : "No data yet",
      trend: "flat",
      hint: "all venues, this month",
    },
    {
      label: "Labour cost",
      value: labourPct !== null ? `${labourPct.toFixed(1)}%` : "—",
      delta: labourPct !== null ? "of revenue" : "No data yet",
      trend: "flat",
      hint: "all venues, this month",
    },
    {
      label: "Open tasks",
      value: String(openTasks.length),
      delta: `${venues.length} venue${venues.length === 1 ? "" : "s"}`,
      trend: "flat",
      hint: "across the group",
    },
  ]

  // Combined weekly series: sum each venue's 7-day series index-wise so that
  // same-day takings across venues add up (a plain concat would collapse them).
  const perVenueSeries = perVenue.map((d) => revenueThisWeek(d.takings))
  const weekSeries =
    perVenueSeries[0]?.map((pt, i) => ({
      day: pt.day,
      revenue: perVenueSeries.reduce((s, series) => s + (series[i]?.revenue ?? 0), 0),
    })) ?? []

  const mix = computeSalesMix(allTakings)

  // --- Per-venue breakdown rows -------------------------------------------
  const venueRows = perVenue
    .map((d) => {
      const vWeek = revenuePenceForWeek(d.takings, 0)
      const vMonth = revenuePenceForMonth(d.takings, mk)
      const vStock = expensePenceForMonthByCategory(d.expenses, mk, "Stock")
      const vGp = vMonth > 0 ? ((vMonth - vStock) / vMonth) * 100 : null
      const vOpenTasks = d.tasks.filter((t) => !t.done).length
      return {
        id: d.venue.id,
        name: d.venue.name,
        location: d.venue.city ?? d.venue.type ?? "—",
        weekRevenue: vWeek,
        monthRevenue: vMonth,
        gpPct: vGp,
        openTasks: vOpenTasks,
      }
    })
    .sort((a, b) => b.weekRevenue - a.weekRevenue)

  return (
    <>
      <PageHeader
        title="Group overview"
        description={`Combined performance across ${venues.length} venue${
          venues.length === 1 ? "" : "s"
        }.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Group revenue this week</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Combined daily takings, last 7 days
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {hasTakings ? (
              <RevenueChart data={weekSeries} />
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-foreground">No takings logged yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Record daily sales in any venue to see the group revenue trend.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group sales mix</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Revenue by category, all venues</p>
          </CardHeader>
          <CardContent>
            {hasTakings ? (
              <>
                <SalesMixChart data={mix} />
                <ul className="mt-2 flex flex-col gap-2">
                  {mix.map((s) => (
                    <li key={s.category} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                      <span className="text-muted-foreground">{s.category}</span>
                      <span className="ml-auto font-medium text-foreground">{s.value}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-foreground">No sales data</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  The category split appears once takings are logged.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <div>
                <CardTitle>Venues</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Per-venue performance, this week &amp; month to date
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {venueRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No venues yet</p>
                <Link
                  href="/settings?tab=venues"
                  className={cn(buttonVariants({ size: "sm" }), "mt-2")}
                >
                  Add a venue
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-medium">Venue</th>
                      <th className="pb-2 text-right font-medium">Revenue (wk)</th>
                      <th className="pb-2 text-right font-medium">Revenue (MTD)</th>
                      <th className="pb-2 text-right font-medium">GP %</th>
                      <th className="pb-2 text-right font-medium">Open tasks</th>
                      <th className="pb-2 text-right font-medium sr-only">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {venueRows.map((row) => (
                      <GroupVenueRow
                        key={row.id}
                        id={row.id}
                        name={row.name}
                        location={row.location}
                        weekRevenue={gbp0.format(row.weekRevenue / 100)}
                        monthRevenue={gbp0.format(row.monthRevenue / 100)}
                        gpPct={row.gpPct !== null ? `${row.gpPct.toFixed(1)}%` : "—"}
                        openTasks={row.openTasks}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-center">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}
        >
          <ListChecks className="size-4" /> Back to single-venue dashboard
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  )
}
