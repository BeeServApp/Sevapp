// Pure, shared helpers for stock costing and Gross Profit Margin maths. No
// server-only imports so these can run in both client components (the GP
// calculator) and server actions (analytics). All money is in pence, ex-VAT.

export const STOCK_UNITS = ["each", "bottle", "can", "keg", "case", "kg", "litre", "portion"] as const
export type StockUnit = (typeof STOCK_UNITS)[number]

export const STOCK_CATEGORIES = [
  "Draught",
  "Bottled beer",
  "Wine",
  "Spirits",
  "Soft drinks",
  "Food",
  "Snacks",
  "Packaging",
  "General",
] as const

export const ORDER_STATUSES = ["Draft", "Submitted", "Confirmed", "Delivered"] as const
export const COUNT_STATUSES = ["In progress", "Completed"] as const

/**
 * Gross Profit figures for a single product/line, calculated the standard UK
 * hospitality way: GP is measured on ex-VAT values.
 *
 * @param costPence  ex-VAT purchase cost per unit
 * @param salePence  ex-VAT sale price per unit (the "net" price)
 * @param vatRatePct VAT rate applied to the sale (e.g. 20)
 */
export function computeGp(costPence: number, salePence: number, vatRatePct = 20) {
  const cost = Math.max(0, costPence)
  const netSale = Math.max(0, salePence)
  const grossSale = Math.round(netSale * (1 + vatRatePct / 100))
  const profit = netSale - cost
  const marginPct = netSale > 0 ? (profit / netSale) * 100 : 0
  const markupPct = cost > 0 ? (profit / cost) * 100 : 0
  return {
    costPence: cost,
    netSalePence: netSale,
    grossSalePence: grossSale,
    profitPence: profit,
    marginPct,
    markupPct,
  }
}

/** Sale price (ex-VAT, pence) required to hit a target GP margin for a cost. */
export function salePenceForTargetMargin(costPence: number, targetMarginPct: number): number {
  const m = Math.min(99.9, Math.max(0, targetMarginPct)) / 100
  if (m >= 1) return costPence
  return Math.round(costPence / (1 - m))
}

/** Formats a pence value as GBP, e.g. 2500 -> "£25.00". */
export function poundsFromPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}

/** Parses a pounds string (e.g. "12.50") into integer pence. */
export function penceFromPounds(value: string): number {
  const n = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
