"use server"

import "server-only"

import { db } from "@/lib/db"
import {
  company,
  dailyChecklist,
  maintenance,
  meeting,
  pushSubscription,
  reminderLog,
  rotaShift,
  staffMember,
  taskCheck,
  venue,
} from "@/lib/db/schema"
import { getOnShiftStaffIds } from "@/app/actions/tasks"
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

/**
 * Fire day-of reminders for dated work that isn't a shift: task checks,
 * maintenance jobs and meetings due on `dateISO`. Each reminder is sent once per
 * recipient (deduped via reminder_log using a recipient-namespaced `kind`), and
 * lands as an in-app notification + Web Push + email through `notify`.
 *
 * Timing:
 * - A task with a specific `dueTime` fires `lead` minutes before that time.
 * - Everything else (all-day tasks, maintenance, meetings) fires from 08:00
 *   local on the due date.
 * Once due, a reminder fires on the next sweep even if its exact window passed,
 * so a paused cron never permanently misses a reminder.
 */
async function processVenueDueItems(v: VenueCtx, dateISO: string, now: Date): Promise<number> {
  let sent = 0
  const leadMs = v.lead * 60000
  const morningAt = zonedTimeToUtc(dateISO, "08:00", v.tz)

  // Staff for this venue, for assignee resolution and role fan-out.
  const members = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.userId, v.userId), eq(staffMember.venueId, v.id)))
  const withLogin = members.filter((m) => m.linkedUserId)
  const byId = new Map(members.map((m) => [m.id, m]))
  const byLowerName = new Map(withLogin.map((m) => [m.name.trim().toLowerCase(), m]))

  // Send one due reminder to a single recipient, deduped per (item, recipient, day).
  async function fire(opts: {
    refId: number
    type: "task" | "maint" | "meeting"
    recipientKey: string
    staffMemberId: number | null
    recipientUserId: string
    email: string | null
    title: string
    body: string
    href: string
  }) {
    const kind = `${opts.type}-due:${opts.recipientKey}`
    if (await claimReminder(v, opts.refId, opts.staffMemberId, kind, dateISO)) {
      await notify({
        accountId: v.userId,
        recipientUserId: opts.recipientUserId,
        staffMemberId: opts.staffMemberId,
        kind: "reminder",
        title: opts.title,
        body: opts.body,
        href: opts.href,
        email: opts.email,
      })
      sent++
    }
  }

  // ── Task checks due today ────────────────────────────────────────────────
  const tasks = await db
    .select()
    .from(taskCheck)
    .where(
      and(
        eq(taskCheck.userId, v.userId),
        eq(taskCheck.venueId, v.id),
        eq(taskCheck.recurring, false),
        eq(taskCheck.dueDate, dateISO),
      ),
    )
  for (const t of tasks) {
    if (t.status === "Completed") continue
    const dueAt = t.dueTime ? zonedTimeToUtc(dateISO, t.dueTime, v.tz) : morningAt
    if (!dueAt) continue
    const fireAtMs = dueAt.getTime() - (t.dueTime ? leadMs : 0)
    if (now.getTime() < fireAtMs) continue

    const when = t.dueTime ? ` by ${t.dueTime}` : " today"
    const title = `Task due${when}: ${t.title}`
    const body = `${v.name} — please complete "${t.title}"${when}.`

    const recipients: (typeof members)[number][] = []
    if (t.assigneeStaffId) {
      const m = byId.get(t.assigneeStaffId)
      if (m?.linkedUserId) recipients.push(m)
    } else if (t.assigneeRole) {
      for (const m of withLogin) if (m.role === t.assigneeRole) recipients.push(m)
    } else if (t.assignOnShift) {
      // Remind whoever is rostered on shift for this task's due date/time.
      const ids = await getOnShiftStaffIds(v.userId, v.id, dateISO, t.dueTime)
      for (const id of ids) {
        const m = byId.get(id)
        if (m?.linkedUserId) recipients.push(m)
      }
    }
    for (const m of recipients) {
      await fire({
        refId: t.id,
        type: "task",
        recipientKey: String(m.id),
        staffMemberId: m.id,
        recipientUserId: m.linkedUserId as string,
        email: m.email,
        title,
        body,
        href: "/staff",
      })
    }
  }

  // ── Maintenance scheduled today ──────────────────────────────────────────
  if (morningAt && now.getTime() >= morningAt.getTime()) {
    const jobs = await db
      .select()
      .from(maintenance)
      .where(
        and(
          eq(maintenance.userId, v.userId),
          eq(maintenance.venueId, v.id),
          eq(maintenance.scheduledDate, dateISO),
        ),
      )
    for (const j of jobs) {
      if (j.status === "Completed" || j.status === "Closed") continue
      const title = `Maintenance due today: ${j.assetName}`
      const body = `${v.name} — ${j.issue ? `${j.issue}. ` : ""}Scheduled work on ${j.assetName}.`
      const assignee = j.assignee ? byLowerName.get(j.assignee.trim().toLowerCase()) : undefined
      if (assignee?.linkedUserId) {
        await fire({
          refId: j.id,
          type: "maint",
          recipientKey: String(assignee.id),
          staffMemberId: assignee.id,
          recipientUserId: assignee.linkedUserId,
          email: assignee.email,
          title,
          body,
          href: "/operations",
        })
      } else {
        await fire({
          refId: j.id,
          type: "maint",
          recipientKey: "owner",
          staffMemberId: null,
          recipientUserId: v.userId,
          email: null,
          title,
          body,
          href: "/operations",
        })
      }
    }
  }

  // ── Meetings scheduled today ─────────────────────────────────────────────
  if (morningAt && now.getTime() >= morningAt.getTime()) {
    const meetings = await db
      .select()
      .from(meeting)
      .where(
        and(
          eq(meeting.userId, v.userId),
          eq(meeting.venueId, v.id),
          eq(meeting.scheduledDate, dateISO),
        ),
      )
    for (const mt of meetings) {
      if (mt.status === "Completed" || mt.status === "Held") continue
      const title = `Meeting today: ${mt.title}`
      const body = `${v.name} — "${mt.title}" is scheduled for today.`
      if (mt.assignedUserId) {
        const sm = mt.assignedStaffMemberId ? byId.get(mt.assignedStaffMemberId) : undefined
        await fire({
          refId: mt.id,
          type: "meeting",
          recipientKey: mt.assignedStaffMemberId ? String(mt.assignedStaffMemberId) : "user",
          staffMemberId: mt.assignedStaffMemberId ?? null,
          recipientUserId: mt.assignedUserId,
          email: sm?.email ?? null,
          title,
          body,
          href: "/calendar",
        })
      } else {
        await fire({
          refId: mt.id,
          type: "meeting",
          recipientKey: "owner",
          staffMemberId: null,
          recipientUserId: v.userId,
          email: null,
          title,
          body,
          href: "/calendar",
        })
      }
    }
  }

  return sent
}

/** Atomically claim a reminder slot. Returns true only for the first caller. */
async function claimReminder(
  v: VenueCtx,
  shiftId: number,
  staffMemberId: number | null,
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
    // Day-of reminders for tasks, maintenance and meetings due today.
    sent += await processVenueDueItems(ctx, todayISO, now)
  }

  return { venues: venues.length, sent }
}
