"use server"

import "server-only"

import { db } from "@/lib/db"
import { notification } from "@/lib/db/schema"
import { getSession } from "@/lib/session"
import { emitChange } from "@/lib/realtime"
import { sendEmail } from "@/lib/email"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

/**
 * Internal helper (not a form action) used by other server actions to raise a
 * notification for a recipient. Writes the in-app row, emits a realtime change,
 * and optionally sends an email.
 */
export async function notify(opts: {
  accountId: string
  recipientUserId: string
  staffMemberId?: number | null
  kind?: string
  title: string
  body?: string
  href?: string
  email?: string | null
}) {
  await db.insert(notification).values({
    userId: opts.accountId,
    recipientUserId: opts.recipientUserId,
    staffMemberId: opts.staffMemberId ?? null,
    kind: opts.kind ?? "shift",
    title: opts.title,
    body: opts.body,
    href: opts.href,
  })

  await emitChange(opts.accountId, "notifications")

  if (opts.email) {
    await sendEmail({
      to: opts.email,
      subject: opts.title,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#111">
        <h2 style="margin:0 0 8px">${escapeHtml(opts.title)}</h2>
        ${opts.body ? `<p style="margin:0 0 12px;color:#444">${escapeHtml(opts.body)}</p>` : ""}
        <p style="margin:0;color:#888;font-size:13px">Sent from your TapSheet workspace.</p>
      </div>`,
      text: `${opts.title}\n\n${opts.body ?? ""}`,
    })
  }
}

export async function getNotifications() {
  const session = await getSession()
  if (!session?.user) return []
  return db
    .select()
    .from(notification)
    .where(eq(notification.recipientUserId, session.user.id))
    .orderBy(desc(notification.createdAt))
    .limit(50)
}

export async function getUnreadCount() {
  const session = await getSession()
  if (!session?.user) return 0
  const rows = await db
    .select({ id: notification.id })
    .from(notification)
    .where(and(eq(notification.recipientUserId, session.user.id), eq(notification.read, false)))
  return rows.length
}

export async function markNotificationRead(id: number) {
  const session = await getSession()
  if (!session?.user) throw new Error("Unauthorized")
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.id, id), eq(notification.recipientUserId, session.user.id)))
  revalidatePath("/", "layout")
}

export async function markAllNotificationsRead() {
  const session = await getSession()
  if (!session?.user) throw new Error("Unauthorized")
  await db
    .update(notification)
    .set({ read: true })
    .where(eq(notification.recipientUserId, session.user.id))
  revalidatePath("/", "layout")
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )
}
