import "server-only"

import Stripe from "stripe"

let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not set. Add it to your environment variables to use billing features.")
    }
    stripeClient = new Stripe(apiKey)
  }
  return stripeClient
}

// Lazy proxy: the Stripe client is only instantiated on first property access,
// so importing this module never throws at build time when STRIPE_SECRET_KEY is absent.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})
