// Shared helpers for the rota board: shift colours and time/cost math.

export const SHIFT_COLORS = ["green", "blue", "purple", "amber", "rose", "teal"] as const
export type ShiftColor = (typeof SHIFT_COLORS)[number]

// Tailwind classes per shift colour. These are functional category colours
// (like Square's role colours), rendered as soft chips on the rota grid.
export const SHIFT_COLOR_CLASSES: Record<string, { block: string; dot: string; label: string }> = {
  green: {
    block: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:border-emerald-300",
    dot: "bg-emerald-500",
    label: "Green",
  },
  blue: {
    block: "bg-sky-50 border-sky-200 text-sky-900 hover:border-sky-300",
    dot: "bg-sky-500",
    label: "Blue",
  },
  purple: {
    block: "bg-violet-50 border-violet-200 text-violet-900 hover:border-violet-300",
    dot: "bg-violet-500",
    label: "Purple",
  },
  amber: {
    block: "bg-amber-50 border-amber-200 text-amber-900 hover:border-amber-300",
    dot: "bg-amber-500",
    label: "Amber",
  },
  rose: {
    block: "bg-rose-50 border-rose-200 text-rose-900 hover:border-rose-300",
    dot: "bg-rose-500",
    label: "Rose",
  },
  teal: {
    block: "bg-teal-50 border-teal-200 text-teal-900 hover:border-teal-300",
    dot: "bg-teal-500",
    label: "Teal",
  },
}

export function colorClasses(color: string | null | undefined) {
  return SHIFT_COLOR_CLASSES[color ?? "green"] ?? SHIFT_COLOR_CLASSES.green
}

/** Parse "HH:MM" into minutes since midnight. Returns null if invalid. */
function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/**
 * Paid duration in hours for a shift, accounting for an unpaid break and
 * overnight shifts (end before start wraps past midnight). Returns 0 if unknown.
 */
export function shiftHours(startTime: string | null, endTime: string | null, breakMins = 0): number {
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if (start == null || end == null) return 0
  if (end < start) end += 24 * 60 // overnight
  const mins = Math.max(0, end - start - (breakMins ?? 0))
  return mins / 60
}

export function formatHours(hours: number): string {
  if (hours <= 0) return "0h"
  const whole = Math.floor(hours)
  const mins = Math.round((hours - whole) * 60)
  if (mins === 0) return `${whole}h`
  if (whole === 0) return `${mins}m`
  return `${whole}h ${mins}m`
}

export function formatMoney(pence: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(pence / 100)
}

/** Compact time label e.g. "9:30–15:00". */
export function timeLabel(startTime: string | null, endTime: string | null, fallback?: string | null): string {
  if (startTime && endTime) return `${startTime}–${endTime}`
  return fallback ?? ""
}
