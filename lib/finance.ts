import type { DbTakings, DbExpense } from "@/lib/db/schema"

export const gbp0 = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
})

export const SALES_CATEGORIES = [
  { key: "wetPence", label: "Wet (drinks)", fill: "var(--chart-1)" },
  { key: "foodPence", label: "Food", fill: "var(--chart-2)" },
  { key: "eventsPence", label: "Events", fill: "var(--chart-4)" },
  { key: "retailPence", label: "Retail", fill: "var(--chart-3)" },
  { key: "squarePence", label: "Card sales (Square)", fill: "var(--chart-5)" },
] as const

const EXPENSE_FILLS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function takingsTotalPence(t: DbTakings) {
  // Square card sales are summed on top of the manually-logged categories.
  return t.wetPence + t.foodPence + t.eventsPence + t.retailPence + (t.squarePence ?? 0)
}

/** Local YYYY-MM-DD for a Date (timezone-safe). */
function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Revenue (in £) for each of the last 7 calendar days, ending today. */
export function revenueThisWeek(takings: DbTakings[]) {
  const byDate = new Map(takings.map((t) => [t.dateISO, takingsTotalPence(t)]))
  const out: { day: string; revenue: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const dt = new Date()
    dt.setHours(0, 0, 0, 0)
    dt.setDate(dt.getDate() - i)
    out.push({
      day: dt.toLocaleDateString("en-GB", { weekday: "short" }),
      revenue: (byDate.get(isoOf(dt)) ?? 0) / 100,
    })
  }
  return out
}

/** Sales mix (percentage share) by category across all supplied takings. */
export function salesMix(takings: DbTakings[]) {
  const totals = SALES_CATEGORIES.map((c) => ({
    category: c.label,
    fill: c.fill,
    pence: takings.reduce((s, t) => s + (t[c.key] as number), 0),
  }))
  const total = totals.reduce((s, c) => s + c.pence, 0)
  return totals.map((c) => ({
    category: c.category,
    fill: c.fill,
    value: total > 0 ? Math.round((c.pence / total) * 100) : 0,
  }))
}

/** Revenue by category (£, this month) for the targets/breakdown widget. */
export function revenueByCategoryMTD(takings: DbTakings[]) {
  const mk = monthKeyOf(new Date())
  const inMonth = takings.filter((t) => t.dateISO.slice(0, 7) === mk)
  return SALES_CATEGORIES.map((c) => ({
    label: c.label,
    fill: c.fill,
    pounds: inMonth.reduce((s, t) => s + (t[c.key] as number), 0) / 100,
  }))
}

/** Last `n` month buckets (oldest → newest). */
export function lastNMonths(n: number) {
  const out: { key: string; label: string }[] = []
  const base = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base.getFullYear(), base.getMonth() - i, 1)
    out.push({ key: monthKeyOf(dt), label: dt.toLocaleDateString("en-GB", { month: "short" }) })
  }
  return out
}

/** Monthly revenue vs costs for the last `n` months (£). */
export function profitSeries(takings: DbTakings[], expenses: DbExpense[], n = 6) {
  const months = lastNMonths(n)
  return months.map((m) => {
    const revenue = takings
      .filter((t) => t.dateISO.slice(0, 7) === m.key)
      .reduce((s, t) => s + takingsTotalPence(t), 0)
    const costs = expenses
      .filter((e) => monthKeyOf(new Date(e.createdAt)) === m.key)
      .reduce((s, e) => s + e.amountPence, 0)
    return { month: m.label, revenue: revenue / 100, costs: costs / 100 }
  })
}

/** Expense share by category (percentage). */
export function expenseBreakdown(expenses: DbExpense[]) {
  const byCat = new Map<string, number>()
  for (const e of expenses) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountPence)
  }
  const total = [...byCat.values()].reduce((s, v) => s + v, 0)
  return [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, pence], i) => ({
      category,
      value: total > 0 ? Math.round((pence / total) * 100) : 0,
      fill: EXPENSE_FILLS[i % EXPENSE_FILLS.length],
    }))
}

export function sumPence<T>(rows: T[], pick: (r: T) => number) {
  return rows.reduce((s, r) => s + pick(r), 0)
}

/** Sum of takings revenue (pence) within a given month key. */
export function revenuePenceForMonth(takings: DbTakings[], monthKey: string) {
  return takings
    .filter((t) => t.dateISO.slice(0, 7) === monthKey)
    .reduce((s, t) => s + takingsTotalPence(t), 0)
}

/** Sum of expenses (pence) within a given month key (by createdAt). */
export function expensePenceForMonth(expenses: DbExpense[], monthKey: string) {
  return expenses
    .filter((e) => monthKeyOf(new Date(e.createdAt)) === monthKey)
    .reduce((s, e) => s + e.amountPence, 0)
}

/** Expenses (pence) in a month restricted to a category. */
export function expensePenceForMonthByCategory(
  expenses: DbExpense[],
  monthKey: string,
  category: string,
) {
  return expenses
    .filter((e) => monthKeyOf(new Date(e.createdAt)) === monthKey && e.category === category)
    .reduce((s, e) => s + e.amountPence, 0)
}

export function thisMonthKey() {
  return monthKeyOf(new Date())
}

export function lastMonthKey() {
  const d = new Date()
  return monthKeyOf(new Date(d.getFullYear(), d.getMonth() - 1, 1))
}

/** Revenue (pence) for the 7 days ending `offsetDays` ago. */
export function revenuePenceForWeek(takings: DbTakings[], offsetDays = 0) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - offsetDays - 6)
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - offsetDays)
  return takings
    .filter((t) => t.dateISO >= isoOf(start) && t.dateISO <= isoOf(end))
    .reduce((s, t) => s + takingsTotalPence(t), 0)
}
