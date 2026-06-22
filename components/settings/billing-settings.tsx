"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, CreditCard, MapPin, Sparkles, RefreshCw, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  PRICING_TIERS,
  formatGBP,
  MAX_PRICE_PER_LOCATION_PENCE,
  TRIAL_PERIOD_DAYS,
  type PlanId,
} from "@/lib/pricing"
import type { BillingState } from "@/app/actions/billing"
import {
  startSubscriptionCheckout,
  createPortalSession,
  syncLocationQuantity,
} from "@/app/actions/billing"

const STATUS_LABELS: Record<string, { label: string; tone: "brand" | "warn" | "muted" }> = {
  trialing: { label: "Free trial", tone: "brand" },
  active: { label: "Active", tone: "brand" },
  past_due: { label: "Payment due", tone: "warn" },
  unpaid: { label: "Unpaid", tone: "warn" },
  canceled: { label: "Canceled", tone: "muted" },
  none: { label: "No plan", tone: "muted" },
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function BillingSettings({ billing }: { billing: BillingState }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusMeta = STATUS_LABELS[billing.status] ?? STATUS_LABELS.none
  const trialDaysLeft = billing.status === "trialing" ? daysUntil(billing.trialEndsAt) : null
  const quantityOutOfSync =
    billing.hasSubscription &&
    billing.billedQuantity != null &&
    billing.billedQuantity !== billing.locations

  function handleSubscribe(planId: PlanId) {
    setError(null)
    setBusyPlan(planId)
    startTransition(async () => {
      try {
        const url = await startSubscriptionCheckout(planId)
        window.location.href = url
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start checkout.")
        setBusyPlan(null)
      }
    })
  }

  function handlePortal() {
    setError(null)
    startTransition(async () => {
      try {
        const url = await createPortalSession()
        window.location.href = url
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open billing portal.")
      }
    })
  }

  function handleSyncLocations() {
    setError(null)
    startTransition(async () => {
      try {
        await syncLocationQuantity()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update locations.")
      }
    })
  }

  return (
    <div className="grid gap-4">
      {/* ── Current subscription summary ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              Subscription
            </CardTitle>
            <Badge
              className={cn(
                statusMeta.tone === "brand" && "bg-brand/15 text-brand",
                statusMeta.tone === "warn" && "bg-destructive/15 text-destructive",
                statusMeta.tone === "muted" && "bg-muted text-muted-foreground",
              )}
            >
              {statusMeta.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Beeserv is billed per location. Every plan starts with a {TRIAL_PERIOD_DAYS}-day free trial.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {billing.status === "trialing" && trialDaysLeft != null && (
            <div className="flex items-start gap-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-sm text-foreground">
                You&apos;re on a free trial — <span className="font-medium">{trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left</span>.
                Your first payment is on {formatDate(billing.trialEndsAt)}.
              </p>
            </div>
          )}

          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">Current plan</dt>
              <dd className="mt-1 font-heading text-lg font-semibold text-foreground">
                {billing.plan ? PRICING_TIERS.find((t) => t.id === billing.plan)?.name : "None"}
              </dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> Locations
              </dt>
              <dd className="mt-1 font-heading text-lg font-semibold text-foreground">
                {billing.locations}
                {billing.billedQuantity != null && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({billing.billedQuantity} billed)
                  </span>
                )}
              </dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">Monthly total</dt>
              <dd className="mt-1 font-heading text-lg font-semibold text-foreground">
                {billing.monthlyTotalPence != null ? formatGBP(billing.monthlyTotalPence) : "—"}
                {billing.pricePerLocationPence != null && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({formatGBP(billing.pricePerLocationPence)}/location)
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {billing.hasSubscription && (
            <p className="text-xs text-muted-foreground">
              {billing.status === "trialing" ? "Trial ends" : "Renews"} on {formatDate(billing.currentPeriodEnd ?? billing.trialEndsAt)}.
            </p>
          )}

          {quantityOutOfSync && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <AlertCircle className="size-4 shrink-0 text-destructive" />
                Your location count changed. Update billing to charge for {billing.locations} location
                {billing.locations === 1 ? "" : "s"}.
              </p>
              <Button size="sm" variant="outline" onClick={handleSyncLocations} disabled={pending}>
                <RefreshCw className="size-3.5" /> Update locations
              </Button>
            </div>
          )}

          {billing.hasSubscription && (
            <div>
              <Button variant="outline" onClick={handlePortal} disabled={pending}>
                Manage billing &amp; payment method
              </Button>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Plan picker ──────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const isCurrent = billing.plan === tier.id && billing.hasSubscription
          return (
            <Card
              key={tier.id}
              className={cn(
                "relative flex flex-col",
                tier.popular && "border-brand ring-1 ring-brand",
              )}
            >
              {tier.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-xs font-medium text-brand-foreground">
                  Most popular
                </span>
              )}
              <CardHeader>
                <CardTitle className="font-heading text-lg">{tier.name}</CardTitle>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-bold text-foreground">
                    {formatGBP(tier.pricePerLocationPence)}
                  </span>
                  <span className="text-sm text-muted-foreground">/location / month</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex flex-col gap-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-2">
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    disabled={pending || isCurrent}
                    onClick={() => handleSubscribe(tier.id)}
                  >
                    {isCurrent
                      ? "Current plan"
                      : busyPlan === tier.id
                        ? "Redirecting…"
                        : billing.hasSubscription
                          ? "Switch to this plan"
                          : `Start ${TRIAL_PERIOD_DAYS}-day free trial`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="size-3.5" />
        Pricing is capped at {formatGBP(MAX_PRICE_PER_LOCATION_PENCE)} per location. You can cancel or
        change your plan at any time during the trial.
      </p>
    </div>
  )
}
