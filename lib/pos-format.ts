/** Client-safe money helpers for the EPOS module (amounts stored in pence). */

export function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}

/** Parse a "12.50" pounds string into integer pence. Returns null if invalid. */
export function parsePoundsToPence(value: string): number | null {
  const trimmed = value.trim().replace(/[£,\s]/g, "")
  if (trimmed === "") return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 100)
}
