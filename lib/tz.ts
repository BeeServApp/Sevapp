// Timezone helpers for scheduling reminders.
//
// Shift times are stored as wall-clock "HH:MM" strings against a calendar date
// (yyyy-mm-dd) in the venue's timezone (defaults to the company timezone, e.g.
// "Europe/London"). To decide when a reminder is due we need the exact UTC
// instant of a given local date+time, which requires the timezone's UTC offset
// at that moment (DST-aware). We derive it with Intl instead of pulling in a
// date library.

/**
 * The UTC offset (in minutes) of `timeZone` at the given UTC instant. Positive
 * means ahead of UTC (e.g. +60 for British Summer Time).
 */
function offsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, number> = {}
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value)
  }
  // Hour can come back as 24 at midnight in some environments.
  const hour = map.hour === 24 ? 0 : map.hour
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second)
  return Math.round((asUTC - date.getTime()) / 60000)
}

/**
 * Convert a wall-clock date + "HH:MM" in `timeZone` to the corresponding UTC
 * `Date`. Returns null if the time string is invalid.
 */
export function zonedTimeToUtc(dateISO: string, timeHHMM: string, timeZone: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO)
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeHHMM.trim())
  if (!dm || !tm) return null
  const [, y, mo, d] = dm.map(Number) as unknown as number[]
  const hh = Number(tm[1])
  const mm = Number(tm[2])
  if (hh > 23 || mm > 59) return null

  // First guess: treat the local components as if they were UTC.
  const guess = Date.UTC(y, mo - 1, d, hh, mm, 0)
  // The offset at that instant tells us how far off the guess is. Applying it
  // once is accurate except within the ~1h DST transition window, so we refine
  // a second time using the offset at the corrected instant.
  const off1 = offsetMinutes(new Date(guess), timeZone)
  const utc1 = guess - off1 * 60000
  const off2 = offsetMinutes(new Date(utc1), timeZone)
  const utc2 = guess - off2 * 60000
  return new Date(utc2)
}

/**
 * The current calendar date (yyyy-mm-dd) in `timeZone`.
 */
export function todayISOInTz(timeZone: string, now = new Date()): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  // en-CA formats as yyyy-mm-dd.
  return dtf.format(now)
}
