import "server-only"

/**
 * Lightweight, dependency-free HTML email templates for TapSheet's transactional
 * emails (email verification, two-factor codes, team invites). Each builder
 * returns a subject-agnostic body; `renderEmail` wraps the inner HTML in a shared
 * branded shell and derives a plain-text fallback.
 */

interface EmailBody {
  /** Inner HTML (without the surrounding shell). */
  html: string
  /** Plain-text fallback. */
  text: string
  /** Optional preheader shown in inbox previews. */
  preheader?: string
}

const BRAND = "TapSheet"
const BRAND_COLOR = "#16a34a"

/** Wraps an email body in a responsive, branded HTML shell. */
export function renderEmail(body: EmailBody): { html: string; text: string } {
  const preheader = body.preheader
    ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${body.preheader}</span>`
    : ""
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:${BRAND_COLOR};padding:20px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${BRAND}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${body.html}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;">
                  You're receiving this email because an action was taken on your ${BRAND} account.
                  If this wasn't you, you can safely ignore this message.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  return { html, text: body.text }
}

/** Email verification link sent on sign-up. */
export function verifyEmailTemplate({ name, url }: { name?: string | null; url: string }): EmailBody {
  const greeting = name ? `Hi ${name},` : "Hi there,"
  return {
    preheader: "Confirm your email address to secure your TapSheet account.",
    html: `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:700;color:#111827;">Verify your email</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#374151;">${greeting}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#374151;">
        Confirm this is your email address so we can keep your account secure and send you important updates.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="border-radius:8px;background-color:${BRAND_COLOR};">
            <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Verify email address</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#6b7280;">Or paste this link into your browser:</p>
      <p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${url}" style="color:${BRAND_COLOR};">${url}</a></p>
    `,
    text: `${greeting}\n\nConfirm your email address for TapSheet by opening this link:\n${url}\n\nIf you didn't create an account, you can ignore this email.`,
  }
}

/** One-time login code for email-based two-factor authentication. */
export function twoFactorOtpTemplate({ name, otp }: { name?: string | null; otp: string }): EmailBody {
  const greeting = name ? `Hi ${name},` : "Hi there,"
  return {
    preheader: `Your verification code is ${otp}.`,
    html: `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:700;color:#111827;">Your verification code</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#374151;">${greeting}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#374151;">
        Enter this code to finish signing in. It expires in a few minutes.
      </p>
      <div style="margin:0 0 24px;padding:16px 24px;background-color:#f3f4f6;border-radius:10px;text-align:center;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;font-family:'Courier New',monospace;">${otp}</span>
      </div>
      <p style="margin:0;font-size:13px;line-height:20px;color:#6b7280;">
        If you didn't try to sign in, someone may have your password. Change it as soon as possible.
      </p>
    `,
    text: `${greeting}\n\nYour TapSheet verification code is: ${otp}\n\nIt expires shortly. If you didn't try to sign in, change your password.`,
  }
}

/** Invitation email with a join link for a new team member. */
export function teamInviteTemplate({
  inviterName,
  companyName,
  roleLabel,
  venueName,
  url,
}: {
  inviterName?: string | null
  companyName: string
  roleLabel: string
  venueName: string
  url: string
}): EmailBody {
  const from = inviterName ? `${inviterName} has` : "You've been"
  return {
    preheader: `Join ${companyName} on TapSheet.`,
    html: `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:700;color:#111827;">You're invited to join ${companyName}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#374151;">
        ${from} invited to join <strong>${companyName}</strong> on TapSheet as a <strong>${roleLabel}</strong> at <strong>${venueName}</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#374151;">
        Set up your login to view your rota, clock in and out, and manage your shifts.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="border-radius:8px;background-color:${BRAND_COLOR};">
            <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Accept invitation</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#6b7280;">Or paste this link into your browser:</p>
      <p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${url}" style="color:${BRAND_COLOR};">${url}</a></p>
    `,
    text: `${from} invited to join ${companyName} on TapSheet as a ${roleLabel} at ${venueName}.\n\nAccept your invitation:\n${url}`,
  }
}
