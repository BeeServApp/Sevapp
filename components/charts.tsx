"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

interface RevenuePoint {
  day: string
  revenue: number
}

interface MixSlice {
  category: string
  value: number
  fill: string
}

interface ProfitPoint {
  month: string
  revenue: number
  costs: number
}

/* ----------------------------- Daily revenue ----------------------------- */

const revenueConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ChartContainer config={revenueConfig} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
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
          tickFormatter={(v) => (v >= 1000 ? `£${v / 1000}k` : `£${v}`)}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="revenue"
          type="monotone"
          fill="url(#fillRevenue)"
          stroke="var(--color-revenue)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/* -------------------------------- Sales mix ------------------------------- */

const salesConfig = {
  value: { label: "Share" },
} satisfies ChartConfig

export function SalesMixChart({ data }: { data: MixSlice[] }) {
  return (
    <ChartContainer config={salesConfig} className="mx-auto h-[220px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
        <Pie data={data} dataKey="value" nameKey="category" innerRadius={55} strokeWidth={2}>
          {data.map((d) => (
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

export function ProfitChart({ data }: { data: ProfitPoint[] }) {
  return (
    <ChartContainer config={plConfig} className="h-[280px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => (v >= 1000 ? `£${v / 1000}k` : `£${v}`)}
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

export function ExpenseChart({ data }: { data: MixSlice[] }) {
  return (
    <ChartContainer config={expenseConfig} className="mx-auto h-[220px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
        <Pie data={data} dataKey="value" nameKey="category" innerRadius={55} strokeWidth={2}>
          {data.map((d) => (
            <Cell key={d.category} fill={d.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
