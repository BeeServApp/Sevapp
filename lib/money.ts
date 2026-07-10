// Small money helpers for the EPOS module. Prices are stored as integer pence
// throughout the POS tables to avoid floating-point rounding on sales.

/** Format an integer pence amount as a localized currency string (e.g. £4.50). */
export function formatPence(pence: number, currency = "GBP", locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format((pence || 0) / 100)
}

/** Parse a pounds string/number (e.g. "4.50") into integer pence. */
export function poundsToPence(value: string | number): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Convert integer pence to a plain pounds number (e.g. 450 → 4.5). */
export function penceToPounds(pence: number): number {
  return (pence || 0) / 100
}
