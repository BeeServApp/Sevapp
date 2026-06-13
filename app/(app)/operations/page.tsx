"use client"

import { Plus, Truck, Wrench, CalendarDays, ListChecks, Star } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  orders,
  suppliers,
  maintenanceJobs,
  events,
  tasks,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const summary = [
  { label: "Open orders", value: orders.filter((o) => o.status !== "Delivered").length, icon: Truck },
  { label: "Active suppliers", value: suppliers.length, icon: Truck },
  { label: "Maintenance jobs", value: maintenanceJobs.filter((m) => m.status !== "Resolved").length, icon: Wrench },
  { label: "Upcoming events", value: events.length, icon: CalendarDays },
  { label: "Tasks due", value: tasks.filter((t) => !t.done).length, icon: ListChecks },
]

const priorityClasses: Record<string, string> = {
  High: "bg-destructive/12 text-destructive",
  Medium: "bg-chart-4/20 text-[oklch(0.45_0.11_70)]",
  Low: "bg-muted text-muted-foreground",
}

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        description="Orders, suppliers, maintenance, events and day-to-day tasks."
        actions={
          <Button className="gap-1.5">
            <Plus className="size-4" /> New order
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summary.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="gap-0 p-4">
              <Icon className="size-4 text-muted-foreground" />
              <p className="mt-2 text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="orders" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        {/* Orders */}
        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.id}</TableCell>
                      <TableCell>{o.supplier}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.items}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{o.total}</TableCell>
                      <TableCell className="text-muted-foreground">{o.due}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers */}
        <TabsContent value="suppliers">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {suppliers.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-start gap-4">
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{s.name}</p>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="size-3.5 fill-chart-4 text-chart-4" /> {s.rating}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.category}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">{s.terms}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {s.spendMtd} <span className="text-xs">MTD</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Maintenance */}
        <TabsContent value="maintenance">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceJobs.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.asset}</TableCell>
                      <TableCell className="text-muted-foreground">{m.issue}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("border-transparent font-medium", priorityClasses[m.priority])}
                        >
                          {m.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{m.assignee}</TableCell>
                      <TableCell><StatusBadge status={m.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events */}
        <TabsContent value="events">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <Card key={ev.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <CalendarDays className="size-5 text-primary" />
                    <StatusBadge status={ev.status} />
                  </div>
                  <p className="mt-3 font-medium text-foreground">{ev.name}</p>
                  <p className="text-sm text-muted-foreground">{ev.date}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">{ev.covers} covers</span>
                    <span className="text-muted-foreground">{ev.owner}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks">
          <Card>
            <CardContent className="flex flex-col gap-1 p-2">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-secondary"
                >
                  <Checkbox defaultChecked={t.done} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        t.done ? "text-muted-foreground line-through" : "text-foreground",
                      )}
                    >
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.area} · {t.assignee}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("border-transparent font-medium", priorityClasses[t.priority])}
                  >
                    {t.priority}
                  </Badge>
                  <span className="w-20 text-right text-xs text-muted-foreground">{t.due}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
