"use server"

import "server-only"

import { db } from "@/lib/db"
import {
  company,
  dailyChecklist,
  pushSubscription,
  reminderLog,
  rotaShift,
  staffMember,
  venue,
} from "@/lib/db/schema"
import { getCurrentUser, requireOwner } from "@/lib/session"
import { notify } from "@/app/actions/notifications"
import { weekStartOf, dayLabelOf } from "@/lib/rota"
import { zonedTimeToUtc, todayISOInTz } from "@/lib/tz"
import { and, eq, inArray } from "drizzle-orm"

// ── Push subscriptions ────────────────────────────────────────────────────────

/** The VAPID public key the browser needs to subscribe. Falls back to the
 * server key so push works even when NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't set. */
export async function getVapidPublicKey(): Promise<string | null> {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null
}

export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

/** Save (or refresh) the current user's Web Push subscription for a device. */
export async function savePushSubscription(sub: PushSubscriptionInput) {
  const me = await getCurrentUser()
  if (!sub.endpoint || !sub.p256dh || !sub.auth) throw new Error("Invalid subscription")

  // Upsert on the unique endpoint so re-subscribing the same device is idempotent.
  await db
    .insert(pushSubscription)
    .values({
      userId: me.accountId,
      recipientUserId: me.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: {
        userId: me.accountId,
        recipientUserId: me.id,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: sub.userAgent ?? null,
      },
    })
  return { ok: true }
}

/** Remove a device's subscription (called when the user disables alerts). */
export async function removePushSubscription(endpoint: string) {
  const me = await getCurrentUser()
  await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.recipientUserId, me.id)))
  return { ok: true }
}

// ── Per-venue reminder settings ───────────────────────────────────────────────

export interface ReminderSettings {
  venueId: number
  venueName: string
  remindersEnabled: boolean
  reminderLeadMins: number
}

/** Reminder settings for every venue in the account (owner-facing). */
export async function getReminderSettings(): Promise<ReminderSettings[]> {
  const me = await getCurrentUser()
  const rows = await db
    .select({
      venueId: venue.id,
      venueName: venue.name,
      remindersEnabled: venue.remindersEnabled,
      reminderLeadMins: venue.reminderLeadMins,
    })
    .from(venue)
    .where(eq(venue.userId, me.accountId))
  return rows
}

/** Owner action: toggle reminders / set the lead time for a venue. */
export async function updateReminderSettings(
  venueId: number,
  input: { remindersEnabled?: boolean; reminderLeadMins?: number },
) {
  const me = await requireOwner()
  const patch: { remindersEnabled?: boolean; reminderLeadMins?: number } = {}
  if (typeof input.remindersEnabled === "boolean") patch.remindersEnabled = input.remindersEnabled
  if (typeof input.reminderLeadMins === "number") {
    // Clamp to a sane range (5 minutes – 6 hours).
    patch.reminderLeadMins = Math.min(360, Math.max(5, Math.round(input.reminderLeadMins)))
  }
  if (Object.keys(patch).length === 0) return { ok: true }

  await db
    .update(venue)
    .set(patch)
    .where(and(eq(venue.id, venueId), eq(venue.userId, me.accountId)))
  return { ok: true }
}

// ── Reminder sweep (called by cron + page-load fallback) ──────────────────────

function toMinutes(t: string | null): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** yyyy-mm-dd shifted by N days. */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

interface VenueCtx {
  id: number
  userId: string
  name: string
  tz: string
  lead: number
}

/**
 * Fire the reminders that are due for a single venue on a single calendar date.
 * - "start": every scheduled staff member is reminded `lead` minutes before
 *   their shift starts; the opener (earliest start) is prompted to complete the
 *   opening checklist.
 * - "closing": the closer (latest finish) is reminded `lead` minutes before
 *   their shift ends to complete the closing checklist.
 * De-duplicated via reminder_log (unique on shiftId+kind+dateISO).
 */
async function processVenueDay(v: VenueCtx, dateISO: string, now: Date, checklistModules: Set<string>): Promise<number> {
  const ws = weekStartOf(new Date(`${dateISO}T12:00:00`))
  const dayLabel = dayLabelOf(dateISO)

  const shifts = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, v.userId),
        eq(rotaShift.venueId, v.id),
        eq(rotaShift.weekStart, ws),
        eq(rotaShift.day, dayLabel),
        eq(rotaShift.status, "published"),
      ),
    )

  const usable = shifts.filter(
    (s) => s.staffMemberId > 0 && toMinutes(s.startTime) != null && toMinutes(s.endTime) != null,
  )
  if (usable.length === 0) return 0

  // Resolve staff logins/emails for the shifts.
  const memberIds = [...new Set(usable.map((s) => s.staffMemberId))]
  const members = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.userId, v.userId), inArray(staffMember.id, memberIds)))
  const memberById = new Map(members.map((m) => [m.id, m]))

  // Opener = earliest start. Closer = latest finish (overnight ends count as +24h).
  const openerId = usable.reduce((best, s) =>
    (toMinutes(s.startTime) as number) < (toMinutes(best.startTime) as number) ? s : best,
  ).id
  const endAbs = (s: (typeof usable)[number]) => {
    const st = toMinutes(s.startTime) as number
    let en = toMinutes(s.endTime) as number
    if (en < st) en += 24 * 60
    return en
  }
  const closerId = usable.reduce((best, s) => (endAbs(s) > endAbs(best) ? s : best)).id

  const hasOpening = checklistModules.has("Opening")
  const hasClosing = checklistModules.has("Closing")
  const leadMs = v.lead * 60000

  let sent = 0

  for (const s of usable) {
    const m = memberById.get(s.staffMemberId)
    if (!m?.linkedUserId) continue

    // ── Shift-start reminder ─────────────────────────────────────────────
    const startAt = zonedTimeToUtc(dateISO, s.startTime as string, v.tz)
    if (startAt) {
      const due = startAt.getTime() - leadMs
      if (now.getTime() >= due && now.getTime() < startAt.getTime()) {
        const isOpener = s.id === openerId
        const title = isOpener
          ? `Opening checks — shift starts ${s.startTime}`
          : `Shift starting at ${s.startTime}`
        const body =
          isOpener && hasOpening
            ? `Your shift at ${v.name} starts soon. Please complete the opening checklist when you arrive.`
            : `Your shift at ${v.name} starts at ${s.startTime}.`
        if (await claimReminder(v, s.id, m.id, "start", dateISO)) {
          await notify({
            accountId: v.userId,
            recipientUserId: m.linkedUserId,
            staffMemberId: m.id,
            kind: "reminder",
            title,
            body,
            href: "/staff",
            email: m.email,
          })
          sent++
        }
      }
    }

    // ── Closing reminder (closer only) ───────────────────────────────────
    if (s.id === closerId) {
      const st = toMinutes(s.startTime) as number
      const en = toMinutes(s.endTime) as number
      const endDateISO = en < st ? addDaysISO(dateISO, 1) : dateISO
      const endAt = zonedTimeToUtc(endDateISO, s.endTime as string, v.tz)
      if (endAt) {
        const due = endAt.getTime() - leadMs
        if (now.getTime() >= due && now.getTime() < endAt.getTime()) {
          const body = hasClosing
            ? `${v.name} closes soon (${s.endTime}). Please complete the closing checklist before you clock out.`
            : `Your shift at ${v.name} ends at ${s.endTime}.`
          if (await claimReminder(v, s.id, m.id, "closing", dateISO)) {
            await notify({
              accountId: v.userId,
              recipientUserId: m.linkedUserId,
              staffMemberId: m.id,
              kind: "reminder",
              title: `Closing checks — shift ends ${s.endTime}`,
              body,
              href: "/staff",
              email: m.email,
            })
            sent++
          }
        }
      }
    }
  }

  return sent
}

/** Atomically claim a reminder slot. Returns true only for the first caller. */
async function claimReminder(
  v: VenueCtx,
  shiftId: number,
  staffMemberId: number,
  kind: string,
  dateISO: string,
): Promise<boolean> {
  const inserted = await db
    .insert(reminderLog)
    .values({ userId: v.userId, venueId: v.id, staffMemberId, shiftId, kind, dateISO })
    .onConflictDoNothing({ target: [reminderLog.shiftId, reminderLog.kind, reminderLog.dateISO] })
    .returning({ id: reminderLog.id })
  return inserted.length > 0
}

/**
 * Session-less: send every shift reminder that has come due across all venues
 * with reminders enabled. Idempotent — each (shift, kind, day) fires once.
 * Processes today and yesterday (yesterday covers overnight closing shifts).
 */
export async function runDueReminders(): Promise<{ venues: number; sent: number }> {
  const now = new Date()
  const venues = await db.select().from(venue).where(eq(venue.remindersEnabled, true))
  if (venues.length === 0) return { venues: 0, sent: 0 }

  // Timezone per account (falls back to Europe/London).
  const accountIds = [...new Set(venues.map((v) => v.userId))]
  const companies = await db
    .select({ userId: company.userId, tz: company.timezone })
    .from(company)
    .where(inArray(company.userId, accountIds))
  const tzByAccount = new Map(companies.map((c) => [c.userId, c.tz || "Europe/London"]))

  let sent = 0
  for (const v of venues) {
    const tz = tzByAccount.get(v.userId) || "Europe/London"
    const ctx: VenueCtx = {
      id: v.id,
      userId: v.userId,
      name: v.name,
      tz,
      lead: v.reminderLeadMins ?? 30,
    }

    // Which checklist types exist for this venue (affects the wording).
    const cls = await db
      .select({ module: dailyChecklist.module })
      .from(dailyChecklist)
      .where(and(eq(dailyChecklist.userId, v.userId), eq(dailyChecklist.venueId, v.id), eq(dailyChecklist.active, true)))
    const modules = new Set(cls.map((c) => c.module))

    const todayISO = todayISOInTz(tz, now)
    const yesterdayISO = addDaysISO(todayISO, -1)
    sent += await processVenueDay(ctx, todayISO, now, modules)
    sent += await processVenueDay(ctx, yesterdayISO, now, modules)
  }

  return { venues: venues.length, sent }
}
