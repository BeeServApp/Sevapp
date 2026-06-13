import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  leaveRequests,
  rota,
  rotaDays,
  staff,
} from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Staff & Scheduling — Tapsheet",
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
}

const onShift = staff.filter((s) => s.status === "On shift").length
const onLeave = staff.filter((s) => s.status === "On leave").length
const totalHours = staff.reduce((sum, s) => sum + s.hoursWk, 0)
const pendingLeave = leaveRequests.filter((l) => l.status === "Pending").length

export default function StaffPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff & Scheduling"
        description="Rotas, annual leave, contracts and team management."
        action={<Button>Publish rota</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard kpi={{ label: "Team members", value: String(staff.length), delta: `${onShift} on shift`, trend: "flat", hint: "active roster" }} />
        <StatCard kpi={{ label: "Scheduled hours", value: `${totalHours}h`, delta: "this week", trend: "flat", hint: "across team" }} />
        <StatCard kpi={{ label: "On leave", value: String(onLeave), delta: `${pendingLeave} pending`, trend: "flat", hint: "requests" }} />
        <StatCard kpi={{ label: "Labour cost", value: "29.1%", delta: "-0.6pt", trend: "down", hint: "of revenue" }} />
      </div>

      <Tabs defaultValue="rota">
        <TabsList>
          <TabsTrigger value="rota">Rota</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        {/* Rota */}
        <TabsContent value="rota" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly rota</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                      Staff
                    </th>
                    {rotaDays.map((d) => (
                      <th key={d} className="px-3 py-2 text-center font-medium text-muted-foreground">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rota.map((row) => (
                    <tr key={row.staff} className="border-t border-border">
                      <td className="sticky left-0 bg-card px-3 py-2.5 font-medium whitespace-nowrap">
                        {row.staff}
                      </td>
                      {row.shifts.map((shift, i) => (
                        <td key={i} className="px-2 py-2.5 text-center">
                          {shift ? (
                            <span className="inline-block rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                              {shift}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Team directory</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead className="text-right">Hours/wk</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">{initials(s.name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.role}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.contract}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.hoursWk}h</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave requests</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{l.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.dates}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.days}</TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {l.status === "Pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline">Decline</Button>
                            <Button size="sm">Approve</Button>
                          </div>
                        ) : (
                          <span className={cn("text-xs text-muted-foreground")}>—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
