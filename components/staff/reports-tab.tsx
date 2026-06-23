"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, PoundSterling, Clock, Percent } from "lucide-react"
import { shiftHours, formatHours, formatMoney, weekRangeLabel } from "@/lib/rota"
import type { DbStaffMember, DbRotaShift } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

interface Props {
  weekStart: string
  rotaDays: string[]
  staff: DbStaffMember[]
  shifts: DbRotaShift[]
  weekSales: Record<string, number>
}

function laburPctClass(pct: number) {
  if (pct === 0) return "text-muted-foreground"
  if (pct <= 30) return "text-emerald-600"
  if (pct <= 40) return "text-amber-600"
  return "text-rose-600"
}

export function ReportsTab({ weekStart, rotaDays, staff, shifts, weekSales }: Props) {
  const perDay = useMemo(() => {
    return rotaDays.map((day) => {
      const dayShifts = shifts.filter((s) => s.day === day)
      const hours = dayShifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins), 0)
      const labour = dayShifts.reduce(
        (sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMins) * (s.payRatePence ?? 0),
        0,
      )
      const sales = weekSales[day] ?? 0
      const pct = sales > 0 ? (labour / sales) * 100 : 0
      return { day, hours, labour, sales, pct }
    })
  }, [rotaDays, shifts, weekSales])

  const totals = useMemo(() => {
    const hours = perDay.reduce((s, d) => s + d.hours, 0)
    const labour = perDay.reduce((s, d) => s + d.labour, 0)
    const sales = perDay.reduce((s, d) => s + d.sales, 0)
    const pct = sales > 0 ? (labour / sales) * 100 : 0
    return { hours, labour, sales, pct }
  }, [perDay])

  const maxBar = Math.max(1, ...perDay.map((d) => Math.max(d.labour, d.sales)))

  // Per-staff breakdown
  const perStaff = useMemo(() => {
    return staff
      .map((s) => {
        const mine = shifts.filter((x) => x.staffMemberId === s.id)
        const hours = mine.reduce((sum, x) => sum + shiftHours(x.startTime, x.endTime, x.breakMins), 0)
        const labour = mine.reduce(
          (sum, x) => sum + shiftHours(x.startTime, x.endTime, x.breakMins) * (x.payRatePence ?? 0),
          0,
        )
        return { id: s.id, name: s.name, hours, labour }
      })
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.labour - a.labour)
  }, [staff, shifts])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon={<PoundSterling className="size-4" />} label="Sales (week)" value={formatMoney(totals.sales)} />
        <SummaryCard icon={<Clock className="size-4" />} label="Scheduled hours" value={formatHours(totals.hours)} />
        <SummaryCard icon={<TrendingUp className="size-4" />} label="Labour cost" value={formatMoney(totals.labour)} />
        <SummaryCard
          icon={<Percent className="size-4" />}
          label="Labour vs sales"
          value={totals.sales > 0 ? `${totals.pct.toFixed(1)}%` : "—"}
          valueClass={laburPctClass(totals.pct)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Labour vs sales — {weekRangeLabel(weekStart)}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Scheduled labour cost against takings for each day. Sales come from your daily takings entries.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {perDay.map((d) => (
              <div key={d.day} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 text-sm">
                <span className="font-medium text-muted-foreground">{d.day}</span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${(d.sales / maxBar) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                      {formatMoney(d.sales)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-4" style={{ width: `${(d.labour / maxBar) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                      {formatMoney(d.labour)}
                    </span>
                  </div>
                </div>
                <span className={cn("w-14 text-right text-sm font-semibold tabular-nums", laburPctClass(d.pct))}>
                  {d.sales > 0 ? `${d.pct.toFixed(0)}%` : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-chart-1" /> Sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-chart-4" /> Labour cost
            </span>
          </div>
        </CardContent>
      </Card>

      {perStaff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cost by team member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {perStaff.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                  <span className="font-medium">{r.name}</span>
                  <span className="flex items-center gap-4 text-muted-foreground">
                    <span className="tabular-nums">{formatHours(r.hours)}</span>
                    <span className="w-20 text-right font-medium text-foreground tabular-nums">
                      {formatMoney(r.labour)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={cn("text-2xl font-semibold tabular-nums", valueClass)}>{value}</span>
      </CardContent>
    </Card>
  )
}
