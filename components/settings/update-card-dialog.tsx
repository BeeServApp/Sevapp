"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { AlertCircle, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createCardSetupIntent, saveDefaultCard } from "@/app/actions/billing"

// Load Stripe once at module scope. Missing key -> null (button stays disabled).
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise: Promise<Stripe | null> | null = publishableKey
  ? loadStripe(publishableKey)
  : null

function CardForm({ onDone, onError }: { onDone: () => void; onError: (msg: string) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    onError("")

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    })

    if (error) {
      onError(error.message ?? "Could not save your card. Please try again.")
      setSubmitting(false)
      return
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id

    if (!paymentMethodId) {
      onError("Card confirmation did not return a payment method.")
      setSubmitting(false)
      return
    }

    try {
      await saveDefaultCard(paymentMethodId)
      onDone()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save your card.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <DialogFooter>
        <Button type="submit" disabled={!stripe || submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save card"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function UpdateCardDialog({ hasCard }: { hasCard: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openDialog = useCallback(async () => {
    setError(null)
    setClientSecret(null)
    setOpen(true)
    setLoading(true)
    try {
      const { clientSecret } = await createCardSetupIntent()
      setClientSecret(clientSecret)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start card setup.")
    } finally {
      setLoading(false)
    }
  }, [])

  function handleDone() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button variant={hasCard ? "outline" : "default"} onClick={openDialog} disabled={!stripePromise}>
        <CreditCard className="size-4" />
        {hasCard ? "Update card" : "Add a card"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasCard ? "Update payment card" : "Add a payment card"}</DialogTitle>
            <DialogDescription>
              Your card is stored securely by Stripe. We never see or store your full card number.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {error}
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Preparing secure form…
            </div>
          )}

          {clientSecret && stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: { theme: "stripe" },
              }}
            >
              <CardForm onDone={handleDone} onError={setError} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
