import "server-only"

import Stripe from "stripe"

let _stripe: Stripe | null = null

/**
 * Lazily create the Stripe client. Instantiating at module scope crashes the
 * whole server render when STRIPE_SECRET_KEY is missing (e.g. before the Stripe
 * integration is connected). Creating it on first use lets callers surface a
 * friendly, catchable error instead.
 */
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      "Stripe is not configured yet. Connect the Stripe integration to this project so STRIPE_SECRET_KEY is set.",
    )
  }
  if (!_stripe) {
    _stripe = new Stripe(key)
  }
  return _stripe
}

/**
 * Proxy that defers client creation until a property is accessed, so importing
 * this module never throws. `stripe.customers.create(...)` works as before.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})

/** True when a Stripe secret key is available in the environment. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}
