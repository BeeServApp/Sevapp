import "server-only"

import webpush from "web-push"
import { db } from "@/lib/db"
import { pushSubscription } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Web Push delivery. Degrades gracefully to a no-op when VAPID keys are not
 * configured, mirroring how email degrades without RESEND_API_KEY — so in-app
 * notifications keep working regardless.
 */

let configured: boolean | null = null

function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  const subject = process.env.VAPID_SUBJECT || "mailto:notifications@tapsheet.app"
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  } catch (err) {
    console.log("[v0] web-push VAPID config failed:", (err as Error).message)
    configured = false
  }
  return configured
}

export interface PushPayload {
  title: string
  body?: string
  href?: string
  tag?: string
}

/**
 * Send a push notification to every subscription belonging to a login. Prunes
 * subscriptions the push service reports as gone (404/410). Never throws.
 */
export async function sendPushToUser(recipientUserId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    console.log("[v0] sendPushToUser skipped (no VAPID keys):", payload.title)
    return
  }

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.recipientUserId, recipientUserId))

  if (subs.length === 0) return

  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          // Subscription is dead — remove it so we stop trying.
          await db
            .delete(pushSubscription)
            .where(eq(pushSubscription.endpoint, sub.endpoint))
            .catch(() => {})
        } else {
          console.log("[v0] web-push send failed:", status, (err as Error).message)
        }
      }
    }),
  )
}
