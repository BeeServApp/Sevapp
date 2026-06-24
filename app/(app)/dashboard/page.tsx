import {
  ClipboardList,
  Wallet,
  Users,
  ShieldCheck,
  ArrowRight,
  CalendarDays,
  Coins,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RevenueChart, SalesMixChart } from "@/components/charts"
import type { Kpi } from "@/lib/mock-data"
import { getSession, getUserId, getActiveVenueId, guardOwnerPage } from "@/lib/session"
import { getVenues } from "@/app/actions/venues"
import { getTasks, getEvents } from "@/app/actions/operations"
import { getTakings } from "@/app/actions/takings"
import { getExpenses } from "@/app/actions/financials"
import { getGamingMachines } from "@/app/actions/gaming"
import { getDashboardLayout } from "@/app/actions/company"
import { SquareSalesSection } from "@/components/square-sales-section"
import { DashboardGrid, type DashboardSection } from "@/components/dashboard/dashboard-grid"
import { DASHBOARD_SECTIONS } from "@/lib/dashboard-sections"
import { sumEntries, entriesForMonth } from "@/lib/gaming"
import {
  gbp0,
  revenueThisWeek,
  salesMix as computeSalesMix,
  revenuePenceForWeek,
  revenuePenceForMonth,
  expensePenceForMonthByCategory,
  thisMonthKey,
} from "@/lib/finance"

const quickLinks = [
  { href: "/operations", label: "Operations", desc: "Orders, suppliers, tasks", icon: ClipboardList },
  { href: "/financials", label: "Financials", desc: "P&L & spending", icon: Wallet },
  { href: "/staff", label: "Staff & Scheduling", desc: "Rotas & leave", icon: Users },
  { href: "/compliance", label: "Compliance", desc: "Checks & certificates", icon: ShieldCheck },
]

function pctDelta(curr: number, prev: number) {
  if (prev <= 0) return null
  return ((curr - prev) / prev) * 100
}

export default async function DashboardPage() {
  const session = await getSession()
  await guardOwnerPage()
  const userId = await getUserId()
  const venueId = await getActiveVenueId(userId)
  const venues = await getVenues()
  const activeVenue = venues.find((v) => v.id === venueId)
  const firstName = (session?.user?.name || "there").split(" ")[0]

  const [tasks, events, takings, expenses, gamingMachines] = venueId
    ? await Promise.all([
        getTasks(venueId),
        getEvents(venueId),
        getTakings(venueId),
        getExpenses(venueId),
        getGamingMachines(venueId),
      ])
    : [[], [], [], [], []]

  const dashboardLayout = await getDashboardLayout()

  // --- KPIs ----------------------------------------------------------------
  const weekRevenue = revenuePenceForWeek(takings, 0)
  const prevWeekRevenue = revenuePenceForWeek(takings, 7)
  const weekDelta = pctDelta(weekRevenue, prevWeekRevenue)

  const mk = thisMonthKey()
  const monthRevenue = revenuePenceForMonth(takings, mk)
  const stockMonth = expensePenceForMonthByCategory(expenses, mk, "Stock")
  const labourMonth = expensePenceForMonthByCategory(expenses, mk, "Staff")
  const gpPct = monthRevenue > 0 ? ((monthRevenue - stockMonth) / monthRevenue) * 100 : null
  const labourPct = monthRevenue > 0 ? (labourMonth / monthRevenue) * 100 : null

  const openTasks = tasks.filter((t) => !t.done)
  const dueToday = openTasks.filter((t) => (t.due ?? "").toLowerCase() === "today").length

  const hasTakings = takings.length > 0

  const kpis: Kpi[] = [
    {
      label: "Net revenue (wk)",
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
      hint: "this month",
    },
    {
      label: "Labour cost",
      value: labourPct !== null ? `${labourPct.toFixed(1)}%` : "—",
      delta: labourPct !== null ? "of revenue" : "No data yet",
      trend: "flat",
      hint: "this month",
    },
    {
      label: "Open tasks",
      value: String(openTasks.length),
      delta: `${dueToday} due today`,
      trend: "flat",
      hint: "across team",
    },
  ]

  const weekSeries = revenueThisWeek(takings)
  const mix = computeSalesMix(takings)
  const todaysTasks = openTasks.slice(0, 6)
  const upcoming = events.slice(0, 3)

  // --- Gaming machines (MTD) ----------------------------------------------
  const gamingEntriesMTD = gamingMachines.flatMap((m) => entriesForMonth(m.entries, mk))
  const gamingMTD = sumEntries(gamingEntriesMTD)
  const hasGaming = gamingMachines.length > 0

  // --- Section nodes -------------------------------------------------------
  // Each entry maps a section id to its rendered content. Sections that aren't
  // applicable (no venue, no gaming) are null and get filtered out.
  const nodeById: Record<string, ReactNode> = {
    kpis: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>
    ),
    revenue: (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Revenue this week</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Daily takings, last 7 days</p>
          </div>
          <Link
            href="/financials"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}
          >
            Details <ArrowRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {hasTakings ? (
            <RevenueChart data={weekSeries} />
          ) : (
            <EmptyState
              title="No takings logged yet"
              body="Record daily sales in Financials to see your revenue trend."
              href="/financials"
              cta="Log takings"
            />
          )}
        </CardContent>
      </Card>
    ),
    salesMix: (
      <Card>
        <CardHeader>
          <CardTitle>Sales mix</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Revenue by category</p>
        </CardHeader>
        <CardContent>
          {hasTakings ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SalesMixChart data={mix} />
              <ul className="flex flex-col justify-center gap-2">
                {mix.map((s) => (
                  <li key={s.category} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                    <span className="text-muted-foreground">{s.category}</span>
                    <span className="ml-auto font-medium text-foreground">{s.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="No sales data" body="Your category split appears once you log takings." />
          )}
        </CardContent>
      </Card>
    ),
    square: venueId ? <SquareSalesSection accountId={userId} venueId={venueId} /> : null,
    quickLinks: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link key={link.href} href={link.href}>
              <Card className="group h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                <CardContent className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{link.label}</p>
                    <p className="truncate text-sm text-muted-foreground">{link.desc}</p>
                  </div>
                  <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    ),
    tasks: (
      <Card>
        <CardHeader>
          <CardTitle>Open tasks</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {todaysTasks.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No open tasks. Add tasks in Operations.
            </p>
          ) : (
            todaysTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary">
                <span className="size-4 rounded-full border-2 border-muted-foreground/40" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.area} · {task.assignee}
                  </p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{task.due}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    ),
    events: (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming events</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events scheduled. Add events in Operations.
            </p>
          ) : (
            upcoming.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="flex size-10 flex-col items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <CalendarDays className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{ev.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.date} · {ev.covers} covers
                  </p>
                </div>
                <div className="ml-auto">
                  <StatusBadge status={ev.status} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    ),
    gaming: hasGaming ? (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Coins className="size-4" />
            </div>
            <div>
              <CardTitle>Gaming machines</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Machine Games Duty &amp; revenue split, month to date
              </p>
            </div>
          </div>
          <Link
            href="/financials?tab=gaming"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}
          >
            Manage <ArrowRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <GamingStat label="Gaming income" value={gbp0.format(gamingMTD.totalIncomePence / 100)} />
            <GamingStat label="MGD due" value={gbp0.format(gamingMTD.mgdPence / 100)} tone="down" />
            <GamingStat
              label="Location share"
              value={gbp0.format(gamingMTD.locationSharePence / 100)}
              tone="up"
            />
            <GamingStat label="Machines" value={String(gamingMachines.filter((m) => m.active).length)} />
          </div>
        </CardContent>
      </Card>
    ) : null,
  }

  const sections: DashboardSection[] = DASHBOARD_SECTIONS.filter(
    (meta) => nodeById[meta.id] != null,
  ).map((meta) => ({ ...meta, node: nodeById[meta.id] }))

  return (
    <>
      <PageHeader
        title={`Good afternoon, ${firstName}`}
        description={
          activeVenue
            ? `Here's how ${activeVenue.name} is performing today.`
            : "Create a venue to get started."
        }
      />

      <DashboardGrid sections={sections} initialLayout={dashboardLayout} />
    </>
  )
}

function GamingStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "up" | "down"
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "down" && "text-destructive",
          tone === "up" && "text-chart-2",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string
  body: string
  href?: string
  cta?: string
}) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
      {href && cta && (
        <Link href={href} className={cn(buttonVariants({ size: "sm" }), "mt-2")}>
          {cta}
        </Link>
      )}
    </div>
  )
}
