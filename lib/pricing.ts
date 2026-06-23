// Single source of truth for Beeserv pricing.
//
// Every tier is billed PER LOCATION (per venue) per month, with a 14-day free
// trial. Prices are stored in pence to avoid floating-point rounding and are
// validated server-side before any Stripe Checkout session is created.

export const TRIAL_PERIOD_DAYS = 14

/**
 * Hard cap on the per-location monthly price (in pence). The business rule is
 * that no plan may ever exceed £35 per location, so this is enforced both in
 * the pricing data below and again server-side when creating a subscription.
 */
export const MAX_PRICE_PER_LOCATION_PENCE = 3500

export type PlanId = "starter" | "growth" | "enterprise"

export interface PricingTier {
  id: PlanId
  name: string
  /** Per-location monthly price in pence. */
  pricePerLocationPence: number
  tagline: string
  features: string[]
  /** Marks the visually highlighted "most popular" tier on the pricing page. */
  popular?: boolean
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    pricePerLocationPence: 500, // £5 / location / month
    tagline: "Everything a single venue needs to get organised.",
    features: [
      "Operations & task management",
      "Staff scheduling & GPS clock-in",
      "Asset register with photo uploads",
      "Excel export",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    pricePerLocationPence: 2500, // £25 / location / month
    tagline: "For growing groups that need financials and compliance.",
    popular: true,
    features: [
      "Everything in Starter",
      "Financials & P&L reporting",
      "Compliance & certificate tracking",
      "Food safety / HACCP module",
      "Multi-venue reporting",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    pricePerLocationPence: 3500, // £35 / location / month (cap)
    tagline: "Maximum plan for large multi-site operators.",
    features: [
      "Everything in Growth",
      "Unlimited team members",
      "Advanced audit history",
      "Custom onboarding",
      "Dedicated account manager",
      "Phone & priority support",
    ],
  },
]

export function getTier(id: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === id)
}

/** Formats a pence value as a GBP string, e.g. 2500 -> "£25". */
export function formatGBP(pence: number): string {
  const pounds = pence / 100
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`
}
