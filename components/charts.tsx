"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  revenueSeries,
  salesMix,
  plSeries,
  expenseBreakdown,
} from "@/lib/mock-data"

/* ----------------------------- Revenue vs target -------------------------- */

const revenueConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  target: { label: "Target", color: "var(--chart-3)" },
} satisfies ChartConfig

export function RevenueChart() {
  return (
    <ChartContainer config={revenueConfig} className="h-[260px] w-full">
      <AreaChart data={revenueSeries} margin={{ left: 4, right: 4, top: 8 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => `£${v / 1000}k`}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="revenue"
          type="monotone"
          fill="url(#fillRevenue)"
          stroke="var(--color-revenue)"
          strokeWidth={2}
        />
        <Line
          dataKey="target"
          type="monotone"
          stroke="var(--color-target)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  )
}

/* -------------------------------- Sales mix ------------------------------- */

const salesConfig = {
  value: { label: "Share" },
} satisfies ChartConfig

export function SalesMixChart() {
  return (
    <ChartContainer config={salesConfig} className="mx-auto h-[220px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
        <Pie data={salesMix} dataKey="value" nameKey="category" innerRadius={55} strokeWidth={2}>
          {salesMix.map((d) => (
            <Cell key={d.category} fill={d.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

/* ---------------------------- P&L (profit) chart -------------------------- */

const plConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  costs: { label: "Costs", color: "var(--chart-3)" },
} satisfies ChartConfig

export function ProfitChart() {
  return (
    <ChartContainer config={plConfig} className="h-[280px] w-full">
      <BarChart data={plSeries} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => `£${v / 1000}k`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="costs" fill="var(--color-costs)" radius={[4, 4, 0, 0]} />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}

/* --------------------------- Expense breakdown ---------------------------- */

const expenseConfig = {
  value: { label: "Share" },
} satisfies ChartConfig

export function ExpenseChart() {
  return (
    <ChartContainer config={expenseConfig} className="mx-auto h-[220px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
        <Pie data={expenseBreakdown} dataKey="value" nameKey="category" innerRadius={55} strokeWidth={2}>
          {expenseBreakdown.map((d) => (
            <Cell key={d.category} fill={d.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
