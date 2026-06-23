import "server-only"

/**
 * Minimal email sender backed by Resend's REST API (no SDK dependency).
 * Degrades gracefully to a no-op when RESEND_API_KEY is not configured, so the
 * app keeps working with in-app notifications only.
 */
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log("[v0] sendEmail skipped (no RESEND_API_KEY):", opts.subject)
    return { sent: false, reason: "no_api_key" }
  }
  const from = process.env.EMAIL_FROM || "TapSheet <onboarding@resend.dev>"

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.log("[v0] Resend error:", res.status, body)
      return { sent: false, reason: `status_${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.log("[v0] sendEmail threw:", (err as Error).message)
    return { sent: false, reason: "exception" }
  }
}
