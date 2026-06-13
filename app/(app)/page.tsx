import {
  ClipboardList,
  Wallet,
  Users,
  ShieldCheck,
  ArrowRight,
  CalendarDays,
} from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { RevenueChart, SalesMixChart } from "@/components/charts"
import {
  dashboardKpis,
  recentActivity,
  salesMix,
  tasks,
  events,
  venue,
} from "@/lib/mock-data"

const quickLinks = [
  { href: "/operations", label: "Operations", desc: "Orders, suppliers, tasks", icon: ClipboardList },
  { href: "/financials", label: "Financials", desc: "P&L & spending", icon: Wallet },
  { href: "/staff", label: "Staff & Scheduling", desc: "Rotas & leave", icon: Users },
  { href: "/compliance", label: "Compliance", desc: "Checks & certificates", icon: ShieldCheck },
]

export default function DashboardPage() {
  const todaysTasks = tasks.slice(0, 5)
  const upcoming = events.slice(0, 3)

  return (
    <>
      <PageHeader
        title={`Good afternoon, ${venue.manager.split(" ")[0]}`}
        description={`Here's how ${venue.name} is performing today.`}
        actions={
          <Button variant="outline" className="gap-2">
            <CalendarDays className="size-4" />
            This week
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue vs target</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Daily takings this week</p>
            </div>
            <Link
              href="/financials"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "gap-1 text-muted-foreground",
              )}
            >
              Details <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales mix</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Revenue by category</p>
          </CardHeader>
          <CardContent>
            <SalesMixChart />
            <ul className="mt-2 flex flex-col gap-2">
              {salesMix.map((s) => (
                <li key={s.category} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: s.fill }}
                  />
                  <span className="text-muted-foreground">{s.category}</span>
                  <span className="ml-auto font-medium text-foreground">{s.value}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s tasks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {todaysTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary"
              >
                <span
                  className={
                    task.done
                      ? "flex size-4 items-center justify-center rounded-full bg-chart-2 text-[10px] text-card"
                      : "size-4 rounded-full border-2 border-muted-foreground/40"
                  }
                  aria-hidden
                >
                  {task.done ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      task.done
                        ? "truncate text-sm text-muted-foreground line-through"
                        : "truncate text-sm font-medium text-foreground"
                    }
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {task.area} · {task.assignee}
                  </p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{task.due}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                <div>
                  <p className="text-foreground">
                    <span className="font-medium">{item.who}</span> {item.action}{" "}
                    <span className="text-muted-foreground">{item.target}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming events</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcoming.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
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
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
