// Single source of truth for Beeserv pricing and plan entitlements.
//
// Every tier is billed PER LOCATION (per venue) per month and starts with a
// card-less 3-month free trial. Prices are stored in pence to avoid
// floating-point rounding and are validated server-side before any Stripe
// Checkout session is created. Plan entitlements (which modules are unlocked
// and how many venues are allowed) are enforced both in the UI and again
// server-side in the route guards and the venue-creation action.

/** Card-less free trial length. */
export const TRIAL_PERIOD_DAYS = 90

/**
 * Hard cap on the per-location monthly price (in pence). The business rule is
 * that no plan may ever exceed £35 per location, so this is enforced both in
 * the pricing data below and again server-side when creating a subscription.
 */
export const MAX_PRICE_PER_LOCATION_PENCE = 3500

export type PlanId = "hr" | "pro" | "enterprise"

/**
 * Module base paths that are only unlocked on the full plans (Pro & Enterprise).
 * The HR plan does not include these.
 */
export const PREMIUM_MODULE_PATHS = [
  "/operations",
  "/tasks",
  "/assets",
  "/financials",
  "/compliance",
  "/food",
] as const

/** Modules that every plan — including HR — can always use. */
export const CORE_MODULE_PATHS = ["/staff", "/training"] as const

export interface PricingTier {
  id: PlanId
  name: string
  /** Per-location monthly price in pence. */
  pricePerLocationPence: number
  tagline: string
  features: string[]
  /** Marks the visually highlighted "most popular" tier on the pricing page. */
  popular?: boolean
  /**
   * Maximum number of venues (locations) this plan allows. `null` means
   * unlimited (multi-site).
   */
  maxVenues: number | null
  /** True when the plan unlocks every module. HR is the only limited plan. */
  includesAllModules: boolean
  /** Short label describing the venue allowance, shown on the pricing card. */
  venueNote: string
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "hr",
    name: "HR",
    pricePerLocationPence: 999, // £9.99 / location / month
    tagline: "People & training, sorted — for a single venue.",
    maxVenues: 1,
    includesAllModules: false,
    venueNote: "One venue",
    features: [
      "HR module — onboarding, rotas, leave & documents",
      "Training module — courses assigned to your team",
      "GPS clock-in & time tracking",
      "Staff self-service portal",
      "Single venue",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    pricePerLocationPence: 2500, // £25 / location / month
    tagline: "The complete platform for a single venue.",
    popular: true,
    maxVenues: 1,
    includesAllModules: true,
    venueNote: "One venue",
    features: [
      "Everything in Beeserv, unlocked",
      "Operations, tasks & asset tracking",
      "Financials, P&L & live Square sales",
      "Compliance & food safety (HACCP)",
      "HR & training modules",
      "Single venue",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    pricePerLocationPence: 3500, // £35 / location / month (cap)
    tagline: "Everything, across every site you run.",
    maxVenues: null,
    includesAllModules: true,
    venueNote: "Unlimited venues (multi-site)",
    features: [
      "Everything in Pro",
      "Unlimited venues & multi-site reporting",
      "Group overview dashboard",
      "Unlimited team members",
      "Advanced audit history",
      "Dedicated account manager",
      "Phone & priority support",
    ],
  },
]

export function getTier(id: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id)
}

/** Type-guard for a stored plan value. */
export function isPlanId(value: unknown): value is PlanId {
  return value === "hr" || value === "pro" || value === "enterprise"
}

/**
 * Whether a plan unlocks a given app path. Only the HR plan is restricted; it
 * is limited to the core modules (HR + Training). Any unrecognised/legacy plan
 * value is treated as full-access so existing accounts are never locked out.
 */
export function isModuleAllowedForPlan(plan: string | null | undefined, pathname: string): boolean {
  if (plan !== "hr") return true
  return !PREMIUM_MODULE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Maximum venues allowed for a plan. HR and Pro are single-venue; Enterprise
 * (and any legacy/unknown plan) is unlimited.
 */
export function planMaxVenues(plan: string | null | undefined): number | null {
  if (plan === "hr" || plan === "pro") return 1
  return null
}

/** Formats a pence value as a GBP string, e.g. 2500 -> "£25", 999 -> "£9.99". */
export function formatGBP(pence: number): string {
  const pounds = pence / 100
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`
}
