"use server"

import { db } from "@/lib/db"
import { staffMember, rotaShift, leaveRequest, clockEvent, staffInvite } from "@/lib/db/schema"
import { getAccountId, getCurrentUser, requireOwner } from "@/lib/session"
import { emitChange } from "@/lib/realtime"
import { notify } from "@/app/actions/notifications"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ── Staff members ────────────────────────────────────────────────────────────

export async function getStaffMembers(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.userId, accountId), eq(staffMember.venueId, venueId)))
    .orderBy(asc(staffMember.id))
}

/** Pending/accepted invite status per staff member, for the management UI. */
export async function getStaffInviteStatuses(venueId: number) {
  const accountId = await getAccountId()
  const invites = await db
    .select()
    .from(staffInvite)
    .where(and(eq(staffInvite.userId, accountId), eq(staffInvite.venueId, venueId)))
  const map: Record<number, { status: string; token: string }> = {}
  for (const inv of invites) {
    // Prefer pending invites; otherwise keep the latest.
    if (!map[inv.staffMemberId] || inv.status === "pending") {
      map[inv.staffMemberId] = { status: inv.status, token: inv.token }
    }
  }
  return map
}

export async function createStaffMember(data: {
  venueId: number
  name: string
  role: string
  contract: string
  hoursWk: number
  status: string
  email?: string
  phone?: string
}) {
  const me = await requireOwner()
  const [created] = await db
    .insert(staffMember)
    .values({ userId: me.accountId, ...data })
    .returning()
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return created
}

export async function updateStaffMember(
  id: number,
  data: { name?: string; role?: string; contract?: string; hoursWk?: number; status?: string; email?: string; phone?: string },
) {
  const me = await requireOwner()
  const [updated] = await db
    .update(staffMember)
    .set(data)
    .where(and(eq(staffMember.id, id), eq(staffMember.userId, me.accountId)))
    .returning()
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return updated
}

export async function deleteStaffMember(id: number) {
  const me = await requireOwner()
  await db.delete(staffMember).where(and(eq(staffMember.id, id), eq(staffMember.userId, me.accountId)))
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
}

// ── Rota shifts ──────────────────────────────────────────────────────────────

export async function getRotaShifts(venueId: number, weekStart: string) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(rotaShift)
    .where(
      and(eq(rotaShift.userId, accountId), eq(rotaShift.venueId, venueId), eq(rotaShift.weekStart, weekStart)),
    )
    .orderBy(asc(rotaShift.id))
}

export interface ShiftInput {
  id?: number
  venueId: number
  staffMemberId: number // 0 = open shift (unassigned)
  weekStart: string
  day: string
  role?: string | null
  startTime?: string | null
  endTime?: string | null
  color?: string | null
  breakMins?: number
  notes?: string | null
  payRatePence?: number
}

/** Owner action: create or update a single shift block. */
export async function saveShift(data: ShiftInput) {
  const me = await requireOwner()
  const shiftTime = data.startTime && data.endTime ? `${data.startTime}-${data.endTime}` : null

  const values = {
    staffMemberId: data.staffMemberId,
    day: data.day,
    role: data.role ?? null,
    startTime: data.startTime ?? null,
    endTime: data.endTime ?? null,
    shiftTime,
    color: data.color ?? "green",
    breakMins: data.breakMins ?? 0,
    notes: data.notes ?? null,
    payRatePence: data.payRatePence ?? 0,
  }

  let saved
  if (data.id) {
    const [existing] = await db
      .select()
      .from(rotaShift)
      .where(and(eq(rotaShift.id, data.id), eq(rotaShift.userId, me.accountId)))
      .limit(1)
    ;[saved] = await db
      .update(rotaShift)
      .set(values)
      .where(and(eq(rotaShift.id, data.id), eq(rotaShift.userId, me.accountId)))
      .returning()

    // If editing an already-published shift that is assigned, keep staff informed.
    if (existing?.status === "published" && data.staffMemberId > 0) {
      await notifyAssignment(me.accountId, data.staffMemberId, saved)
    }
  } else {
    ;[saved] = await db
      .insert(rotaShift)
      .values({ userId: me.accountId, venueId: data.venueId, weekStart: data.weekStart, status: "draft", ...values })
      .returning()
  }

  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return saved
}

/** Owner action: drag-and-drop move — reassign a shift to a staff member/day. */
export async function moveShift(shiftId: number, targetStaffMemberId: number, targetDay: string) {
  const me = await requireOwner()
  const [existing] = await db
    .select()
    .from(rotaShift)
    .where(and(eq(rotaShift.id, shiftId), eq(rotaShift.userId, me.accountId)))
    .limit(1)
  if (!existing) throw new Error("Shift not found")

  const [updated] = await db
    .update(rotaShift)
    .set({ staffMemberId: targetStaffMemberId, day: targetDay })
    .where(and(eq(rotaShift.id, shiftId), eq(rotaShift.userId, me.accountId)))
    .returning()

  // Notify the new assignee if the rota is already published.
  if (existing.status === "published" && targetStaffMemberId > 0 && targetStaffMemberId !== existing.staffMemberId) {
    await notifyAssignment(me.accountId, targetStaffMemberId, updated)
  }

  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
  return updated
}

export async function deleteShift(shiftId: number) {
  const me = await requireOwner()
  await db.delete(rotaShift).where(and(eq(rotaShift.id, shiftId), eq(rotaShift.userId, me.accountId)))
  await emitChange(me.accountId, "rota")
  revalidatePath("/staff")
}

/**
 * Owner action: publish the week. All draft shifts become published and every
 * assigned staff member with a linked login is notified of their new shifts.
 */
export async function publishRota(venueId: number, weekStart: string) {
  const me = await requireOwner()

  const drafts = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.venueId, venueId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.status, "draft"),
      ),
    )

  if (drafts.length === 0) return { published: 0, notified: 0 }

  await db
    .update(rotaShift)
    .set({ status: "published" })
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.venueId, venueId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.status, "draft"),
      ),
    )

  // Group newly published shifts by assigned staff member.
  const byStaff = new Map<number, typeof drafts>()
  for (const s of drafts) {
    if (s.staffMemberId > 0) {
      const list = byStaff.get(s.staffMemberId) ?? []
      list.push(s)
      byStaff.set(s.staffMemberId, list)
    }
  }

  let notified = 0
  if (byStaff.size > 0) {
    const ids = Array.from(byStaff.keys())
    const members = await db
      .select()
      .from(staffMember)
      .where(and(eq(staffMember.userId, me.accountId), inArray(staffMember.id, ids)))

    for (const m of members) {
      if (!m.linkedUserId) continue
      const shifts = byStaff.get(m.id) ?? []
      const summary = shifts
        .map((s) => `${s.day} ${s.startTime ?? ""}-${s.endTime ?? ""}`.trim())
        .join(", ")
      await notify({
        accountId: me.accountId,
        recipientUserId: m.linkedUserId,
        staffMemberId: m.id,
        kind: "shift",
        title: `You have ${shifts.length} new shift${shifts.length > 1 ? "s" : ""}`,
        body: `Week of ${weekStart}: ${summary}`,
        href: "/staff",
        email: m.email,
      })
      notified++
    }
  }

  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return { published: drafts.length, notified }
}

async function notifyAssignment(accountId: string, staffMemberId: number, shift: typeof rotaShift.$inferSelect) {
  const [m] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, staffMemberId), eq(staffMember.userId, accountId)))
    .limit(1)
  if (!m?.linkedUserId) return
  await notify({
    accountId,
    recipientUserId: m.linkedUserId,
    staffMemberId: m.id,
    kind: "shift",
    title: "Your shift was updated",
    body: `${shift.day}: ${shift.startTime ?? ""}-${shift.endTime ?? ""}${shift.role ? ` (${shift.role})` : ""}`,
    href: "/staff",
    email: m.email,
  })
}

// ── Staff self-service (for the linked staff portal) ──────────────────────────

/** Shifts for the currently logged-in staff member in a given week. */
export async function getMyShifts(weekStart: string) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return []
  return db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, me.accountId),
        eq(rotaShift.staffMemberId, me.staffMemberId),
        eq(rotaShift.weekStart, weekStart),
        eq(rotaShift.status, "published"),
      ),
    )
    .orderBy(asc(rotaShift.day))
}

/** The logged-in staff member's own profile (status, venue, etc.). */
export async function getMyProfile() {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return null
  const [m] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  return m ?? null
}

/** Staff self clock-in/out from the portal. Records against their own record. */
export async function selfClock(type: "in" | "out", coords: { lat: number; lng: number } | null) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) throw new Error("Not a staff account")
  const [m] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)
  if (!m) throw new Error("Staff record not found")

  const locationLabel = coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : null
  const [created] = await db
    .insert(clockEvent)
    .values({
      userId: me.accountId,
      venueId: m.venueId,
      staffMemberId: m.id,
      staffName: m.name,
      type,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      locationLabel,
    })
    .returning()

  await db
    .update(staffMember)
    .set({ status: type === "in" ? "On shift" : "Off" })
    .where(and(eq(staffMember.id, m.id), eq(staffMember.userId, me.accountId)))

  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return created
}

// ── Leave requests ───────────────────────────────────────────────────────────

export async function getLeaveRequests(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(leaveRequest)
    .where(and(eq(leaveRequest.userId, accountId), eq(leaveRequest.venueId, venueId)))
    .orderBy(desc(leaveRequest.createdAt))
}

export async function createLeaveRequest(data: {
  venueId: number
  staffMemberId: number
  name: string
  type: string
  dates: string
  days: number
}) {
  const accountId = await getAccountId()
  const [created] = await db
    .insert(leaveRequest)
    .values({ userId: accountId, status: "Pending", ...data })
    .returning()
  await emitChange(accountId, "all")
  revalidatePath("/staff")
  return created
}

export async function updateLeaveStatus(id: number, status: "Approved" | "Declined") {
  const me = await requireOwner()
  const [updated] = await db
    .update(leaveRequest)
    .set({ status })
    .where(and(eq(leaveRequest.id, id), eq(leaveRequest.userId, me.accountId)))
    .returning()
  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return updated
}

// ── Clock events ─────────────────────────────────────────────────────────────

export async function clockIn(data: {
  venueId: number
  staffMemberId: number
  staffName: string
  lat: number | null
  lng: number | null
  locationLabel: string | null
}) {
  const accountId = await getAccountId()
  const [created] = await db
    .insert(clockEvent)
    .values({ userId: accountId, type: "in", ...data })
    .returning()
  await db
    .update(staffMember)
    .set({ status: "On shift" })
    .where(and(eq(staffMember.id, data.staffMemberId), eq(staffMember.userId, accountId)))
  await emitChange(accountId, "all")
  revalidatePath("/staff")
  return created
}

export async function clockOut(data: {
  venueId: number
  staffMemberId: number
  staffName: string
  lat: number | null
  lng: number | null
  locationLabel: string | null
}) {
  const accountId = await getAccountId()
  const [created] = await db
    .insert(clockEvent)
    .values({ userId: accountId, type: "out", ...data })
    .returning()
  await db
    .update(staffMember)
    .set({ status: "Off" })
    .where(and(eq(staffMember.id, data.staffMemberId), eq(staffMember.userId, accountId)))
  await emitChange(accountId, "all")
  revalidatePath("/staff")
  return created
}

export async function getClockEvents(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(clockEvent)
    .where(and(eq(clockEvent.userId, accountId), eq(clockEvent.venueId, venueId)))
    .orderBy(desc(clockEvent.createdAt))
    .limit(100)
}
