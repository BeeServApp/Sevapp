// Card-terminal payment abstraction for the EPOS module.
//
// This is written to drop straight onto a real cloud card-terminal API such as
// Dojo: given a linked terminal (device id) and an amount, it pushes a payment
// request to the physical reader and resolves once the customer taps/inserts
// their card. When no live terminal credentials are configured (e.g. in
// development/preview), it falls back to a simulated approval so the whole
// till → pay → receipt flow is fully demoable.

export interface TerminalChargeInput {
  provider: string
  deviceId: string
  amountPence: number
  reference: string
  currency?: string
}

export interface TerminalChargeResult {
  approved: boolean
  ref: string
  simulated: boolean
  message?: string
}

/** Whether real Dojo terminal credentials are configured in the environment. */
export function dojoConfigured(): boolean {
  return Boolean(process.env.DOJO_API_KEY && process.env.DOJO_API_BASE)
}

/**
 * Request a card payment on a linked terminal. Returns once the payment is
 * approved/declined. Replace the body of the `dojoConfigured()` branch with the
 * provider's real create-payment + poll calls when going live.
 */
export async function chargeTerminal(input: TerminalChargeInput): Promise<TerminalChargeResult> {
  if (input.provider === "dojo" && dojoConfigured()) {
    try {
      // Real Dojo cloud API integration goes here, e.g.:
      //   const res = await fetch(`${process.env.DOJO_API_BASE}/payments`, {
      //     method: "POST",
      //     headers: { Authorization: `Bearer ${process.env.DOJO_API_KEY}`, "Content-Type": "application/json" },
      //     body: JSON.stringify({ terminalId: input.deviceId, amount: input.amountPence, currency: input.currency ?? "GBP", reference: input.reference }),
      //   })
      //   ...then poll the payment status until it settles.
      throw new Error("Live Dojo integration not yet wired")
    } catch (err) {
      return {
        approved: false,
        ref: input.reference,
        simulated: false,
        message: err instanceof Error ? err.message : "Terminal request failed",
      }
    }
  }

  // Simulated approval (no live terminal credentials configured).
  return { approved: true, ref: `SIM-${input.reference}`, simulated: true }
}
