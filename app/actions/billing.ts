"use server"

import { db } from "@/lib/db"
import { company, venue } from "@/lib/db/schema"
import { requireOwner, getAccountId as getUserId } from "@/lib/session"
import { stripe, isStripeConfigured } from "@/lib/stripe"
import { ensureCompanyRow } from "@/lib/trial"
import {
  getTier,
  MAX_PRICE_PER_LOCATION_PENCE,
  TRIAL_PERIOD_DAYS,
  type PlanId,
} from "@/lib/pricing"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

export interface BillingState {
  plan: PlanId | null
  status: string
  locations: number
  /** Quantity Stripe is currently billing for (may lag behind `locations`). */
  billedQuantity: number | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  hasSubscription: boolean
  hasCustomer: boolean
  /** Per-location price of the active plan, in pence. */
  pricePerLocationPence: number | null
  /** locations * price, in pence. */
  monthlyTotalPence: number | null
  /** Summary of the default card on file, if any. */
  card: CardSummary | null
}

export interface CardSummary {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

async function getCompanyRow(userId: string) {
  return ensureCompanyRow(userId)
}

async function countVenues(userId: string): Promise<number> {
  const rows = await db.select({ id: venue.id }).from(venue).where(eq(venue.userId, userId))
  return rows.length
}

async function getOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

/** Reads subscription fields off a Stripe subscription, tolerant of API shape changes. */
function readSubscriptionFields(sub: import("stripe").Stripe.Subscription) {
  const item = sub.items.data[0]
  // In recent API versions period end moved onto the subscription item.
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    null
  return {
    status: sub.status,
    quantity: item?.quantity ?? null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    periodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  }
}

/**
 * Pulls the latest subscription state from Stripe and persists it locally so
 * the billing UI reflects reality without relying on webhooks.
 */
export async function refreshSubscription(): Promise<void> {
  await requireOwner()
  const userId = await getUserId()
  const row = await getCompanyRow(userId)
  if (!row.stripeSubscriptionId) return

  try {
    const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId)
    const { status, quantity, trialEnd, periodEnd } = readSubscriptionFields(sub)
    await db
      .update(company)
      .set({
        subscriptionStatus: status,
        subscriptionQuantity: quantity,
        trialEndsAt: trialEnd,
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(company.userId, userId))
  } catch {
    // Subscription no longer exists on Stripe — reset local state.
    await db
      .update(company)
      .set({
        subscriptionStatus: "canceled",
        stripeSubscriptionId: null,
        subscriptionQuantity: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        updatedAt: new Date(),
      })
      .where(eq(company.userId, userId))
  }
  revalidatePath("/settings")
}

/**
 * Reads the default card on file for a Stripe customer. Falls back to the
 * subscription's default payment method, then the customer's invoice-settings
 * default. Returns null when no card is attached yet.
 */
async function readDefaultCard(customerId: string): Promise<CardSummary | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    })
    if (!customer || customer.deleted) return null

    const invoiceDefault = (customer as import("stripe").Stripe.Customer).invoice_settings
      ?.default_payment_method
    let pm: import("stripe").Stripe.PaymentMethod | null =
      invoiceDefault && typeof invoiceDefault !== "string" ? invoiceDefault : null

    // Fall back to the first attached card if there is no explicit default.
    if (!pm) {
      const cards = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      })
      pm = cards.data[0] ?? null
    }

    if (!pm?.card) return null
    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    }
  } catch {
    return null
  }
}

export async function getBillingState(): Promise<BillingState> {
  await requireOwner()
  const userId = await getUserId()
  const row = await getCompanyRow(userId)
  const locations = await countVenues(userId)

  const plan = (row.subscriptionPlan as PlanId | null) ?? null
  const tier = plan ? getTier(plan) : undefined
  const price = tier?.pricePerLocationPence ?? null

  const card = row.stripeCustomerId ? await readDefaultCard(row.stripeCustomerId) : null

  return {
    plan,
    status: row.subscriptionStatus ?? "none",
    locations,
    billedQuantity: row.subscriptionQuantity ?? null,
    trialEndsAt: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
    hasSubscription: Boolean(row.stripeSubscriptionId),
    hasCustomer: Boolean(row.stripeCustomerId),
    pricePerLocationPence: price,
    monthlyTotalPence: price != null ? price * Math.max(locations, 1) : null,
    card,
  }
}

/**
 * Creates a Stripe Checkout session (subscription mode, 14-day trial) for the
 * chosen plan, billing one unit per location. Returns the hosted Checkout URL.
 */
export async function startSubscriptionCheckout(planId: PlanId): Promise<string> {
  const me = await requireOwner()
  const userId = await getUserId()

  const tier = getTier(planId)
  if (!tier) throw new Error("Unknown plan")

  // Hard business rule: never bill more than £35 per location.
  if (tier.pricePerLocationPence > MAX_PRICE_PER_LOCATION_PENCE) {
    throw new Error("Plan exceeds the maximum allowed price per location")
  }

  const row = await getCompanyRow(userId)
  const locations = await countVenues(userId)
  const quantity = Math.max(locations, 1)

  // Reuse or create the Stripe customer so we can keep billing history in one place.
  let customerId = row.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: me.email,
      name: row.name || me.name,
      metadata: { userId },
    })
    customerId = customer.id
    await db
      .update(company)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(company.userId, userId))
  }

  const origin = await getOrigin()

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    // Do NOT set payment_method_types — let Stripe pick eligible methods.
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Beeserv ${tier.name}`,
            description: `${tier.tagline} Billed per location.`,
          },
          unit_amount: tier.pricePerLocationPence,
          recurring: { interval: "month" },
        },
        quantity,
      },
    ],
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: { userId, planId },
    },
    metadata: { userId, planId },
    success_url: `${origin}/settings?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings?tab=billing&checkout=cancel`,
  })

  // Optimistically record the chosen plan; status is confirmed after checkout.
  await db
    .update(company)
    .set({ subscriptionPlan: planId, updatedAt: new Date() })
    .where(eq(company.userId, userId))

  if (!session.url) throw new Error("Failed to create checkout session")
  return session.url
}

/**
 * Called on return from Checkout. Confirms the session, stores the resulting
 * subscription, and syncs its live status.
 */
export async function syncSubscriptionFromCheckout(sessionId: string): Promise<void> {
  await requireOwner()
  const userId = await getUserId()

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  // Guard: only accept sessions that belong to this account.
  if (session.metadata?.userId && session.metadata.userId !== userId) return

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id
  const planId = (session.metadata?.planId as PlanId | undefined) ?? undefined

  if (!subscriptionId) return

  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const { status, quantity, trialEnd, periodEnd } = readSubscriptionFields(sub)

  await db
    .update(company)
    .set({
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId ?? undefined,
      subscriptionPlan: planId ?? undefined,
      subscriptionStatus: status,
      subscriptionQuantity: quantity,
      trialEndsAt: trialEnd,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(company.userId, userId))

  revalidatePath("/settings")
}

/**
 * Updates the subscription quantity to match the current number of locations,
 * prorating the change. Useful after adding or removing a venue.
 */
export async function syncLocationQuantity(): Promise<void> {
  await requireOwner()
  const userId = await getUserId()
  const row = await getCompanyRow(userId)
  if (!row.stripeSubscriptionId) throw new Error("No active subscription")

  const locations = await countVenues(userId)
  const quantity = Math.max(locations, 1)

  const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId)
  const item = sub.items.data[0]
  if (!item) throw new Error("Subscription has no items")

  await stripe.subscriptions.update(row.stripeSubscriptionId, {
    items: [{ id: item.id, quantity }],
    proration_behavior: "create_prorations",
  })

  await db
    .update(company)
    .set({ subscriptionQuantity: quantity, updatedAt: new Date() })
    .where(eq(company.userId, userId))

  revalidatePath("/settings")
}

/**
 * Ensures a Stripe customer exists for this account, then creates a SetupIntent
 * so the owner can enter (or replace) their card via Stripe Elements — without
 * leaving the app and even during the card-less free trial. Returns the client
 * secret used to confirm the card on the client.
 */
export async function createCardSetupIntent(): Promise<{ clientSecret: string }> {
  const me = await requireOwner()
  if (!isStripeConfigured()) {
    throw new Error(
      "Payments aren't set up yet. The Stripe integration needs to be connected before you can add a card.",
    )
  }
  const userId = await getUserId()
  const row = await getCompanyRow(userId)

  let customerId = row.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: me.email,
      name: row.name || me.name,
      metadata: { userId },
    })
    customerId = customer.id
    await db
      .update(company)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(company.userId, userId))
  }

  const intent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { userId },
  })

  if (!intent.client_secret) throw new Error("Failed to start card setup")
  return { clientSecret: intent.client_secret }
}

/**
 * Called after the client confirms a SetupIntent. Sets the new card as the
 * customer's default for invoices and, when a subscription exists, as the
 * subscription's default payment method so renewals use the new card.
 */
export async function saveDefaultCard(paymentMethodId: string): Promise<void> {
  await requireOwner()
  const userId = await getUserId()
  const row = await getCompanyRow(userId)
  if (!row.stripeCustomerId) throw new Error("No billing account yet")

  // Make sure the payment method is attached to this customer.
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  const attachedTo = typeof pm.customer === "string" ? pm.customer : pm.customer?.id
  if (attachedTo && attachedTo !== row.stripeCustomerId) {
    throw new Error("Payment method does not belong to this account")
  }
  if (!attachedTo) {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: row.stripeCustomerId })
  }

  await stripe.customers.update(row.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  if (row.stripeSubscriptionId) {
    await stripe.subscriptions
      .update(row.stripeSubscriptionId, { default_payment_method: paymentMethodId })
      .catch(() => {})
  }

  revalidatePath("/settings")
}

/** Opens the Stripe customer portal for self-service management. */
export async function createPortalSession(): Promise<string> {
  await requireOwner()
  const userId = await getUserId()
  const row = await getCompanyRow(userId)
  if (!row.stripeCustomerId) throw new Error("No billing account yet")

  const origin = await getOrigin()
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}/settings?tab=billing`,
  })
  return portal.url
}
