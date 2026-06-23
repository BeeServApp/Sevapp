import Link from "next/link"
import { Check, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { PRICING_TIERS, formatGBP, TRIAL_PERIOD_DAYS } from "@/lib/pricing"

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border bg-muted/20 py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand">Pricing</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Simple per-location pricing
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground">
            Pay only for the venues you run. Every plan includes a {TRIAL_PERIOD_DAYS}-day free trial —
            no charge until it ends, cancel anytime.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-7",
                tier.popular ? "border-brand shadow-lg ring-1 ring-brand" : "border-border",
              )}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground">
                  Most popular
                </span>
              )}

              <h3 className="font-heading text-lg font-semibold text-foreground">{tier.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-bold text-foreground">
                  {formatGBP(tier.pricePerLocationPence)}
                </span>
                <span className="text-sm text-muted-foreground">/location / month</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tier.tagline}</p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={`/sign-up?plan=${tier.id}`}
                className={cn(
                  buttonVariants({ size: "lg", variant: tier.popular ? "default" : "outline" }),
                  "mt-7 w-full gap-2",
                )}
              >
                Start free trial <ArrowRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-muted-foreground">
          All prices in GBP, billed monthly per location and capped at {formatGBP(3500)} per location.
          A payment method is required to start your trial; you won&apos;t be charged until day {TRIAL_PERIOD_DAYS + 1}.
        </p>
      </div>
    </section>
  )
}
