// Traffic-light evaluation for budget targets.
//
// Two directions:
//  - "higher": actual should meet/exceed the target (weekly/monthly sales, GP%).
//  - "lower":  actual should stay at/below the target (labour % of revenue).
//
// Status bands (relative to target):
//  - on:   meeting target (within tolerance for "near")
//  - near: within 10% of target but not yet meeting it (amber)
//  - off:  more than 10% away from target (red)

export type TargetStatus = "on" | "near" | "off"

export type TargetDirection = "higher" | "lower"

const NEAR_TOLERANCE = 0.1 // 10%

/**
 * Evaluate an actual value against a target.
 * Returns null when there is no target or no actual data to compare.
 */
export function evaluateTarget(
  actual: number | null | undefined,
  target: number | null | undefined,
  direction: TargetDirection,
): TargetStatus | null {
  if (target == null || target <= 0) return null
  if (actual == null) return null

  if (direction === "higher") {
    if (actual >= target) return "on"
    if (actual >= target * (1 - NEAR_TOLERANCE)) return "near"
    return "off"
  }

  // direction === "lower" (e.g. labour cost %)
  if (actual <= target) return "on"
  if (actual <= target * (1 + NEAR_TOLERANCE)) return "near"
  return "off"
}

export function statusColorVar(status: TargetStatus): string {
  switch (status) {
    case "on":
      return "var(--status-on)"
    case "near":
      return "var(--status-near)"
    case "off":
      return "var(--status-off)"
  }
}

export function statusLabel(status: TargetStatus): string {
  switch (status) {
    case "on":
      return "On target"
    case "near":
      return "Near target"
    case "off":
      return "Off target"
  }
}
