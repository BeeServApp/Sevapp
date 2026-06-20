"use server"

import { db } from "@/lib/db"
import { staffMember, rotaShift, leaveRequest, clockEvent } from "@/lib/db/schema"
import { getUserId, getActiveVenueId } from "@/lib/session"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ── Staff members ────────────────────────────────────────────────────────────

export async function getStaffMembers(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.userId, userId), eq(staffMember.venueId, venueId)))
    .orderBy(asc(staffMember.id))
}

export async function createStaffMember(data: {
  venueId: number
  name: string
  role: string
  contract: string
  hoursWk: number
  status: string
}) {
  const userId = await getUserId()
  const [created] = await db
    .insert(staffMember)
    .values({ userId, ...data })
    .returning()
  revalidatePath("/staff")
  return created
}

export async function updateStaffMember(
  id: number,
  data: { name?: string; role?: string; contract?: string; hoursWk?: number; status?: string },
) {
  const userId = await getUserId()
  const [updated] = await db
    .update(staffMember)
    .set(data)
    .where(and(eq(staffMember.id, id), eq(staffMember.userId, userId)))
    .returning()
  revalidatePath("/staff")
  return updated
}

export async function deleteStaffMember(id: number) {
  const userId = await getUserId()
  await db.delete(staffMember).where(and(eq(staffMember.id, id), eq(staffMember.userId, userId)))
  revalidatePath("/staff")
}

// ── Rota shifts ──────────────────────────────────────────────────────────────

export async function getRotaShifts(venueId: number, weekStart: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, userId),
        eq(rotaShift.venueId, venueId),
        eq(rotaShift.weekStart, weekStart),
      ),
    )
}

export async function upsertShift(data: {
  venueId: number
  staffMemberId: number
  weekStart: string
  day: string
  shiftTime: string | null
}) {
  const userId = await getUserId()
  // Find existing
  const existing = await db
    .select()
    .from(rotaShift)
    .where(
      and(
        eq(rotaShift.userId, userId),
        eq(rotaShift.venueId, data.venueId),
        eq(rotaShift.staffMemberId, data.staffMemberId),
        eq(rotaShift.weekStart, data.weekStart),
        eq(rotaShift.day, data.day),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    const [updated] = await db
      .update(rotaShift)
      .set({ shiftTime: data.shiftTime })
      .where(eq(rotaShift.id, existing[0].id))
      .returning()
    revalidatePath("/staff")
    return updated
  }

  const [created] = await db
    .insert(rotaShift)
    .values({ userId, ...data })
    .returning()
  revalidatePath("/staff")
  return created
}

// ── Leave requests ───────────────────────────────────────────────────────────

export async function getLeaveRequests(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(leaveRequest)
    .where(and(eq(leaveRequest.userId, userId), eq(leaveRequest.venueId, venueId)))
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
  const userId = await getUserId()
  const [created] = await db
    .insert(leaveRequest)
    .values({ userId, status: "Pending", ...data })
    .returning()
  revalidatePath("/staff")
  return created
}

export async function updateLeaveStatus(id: number, status: "Approved" | "Declined") {
  const userId = await getUserId()
  const [updated] = await db
    .update(leaveRequest)
    .set({ status })
    .where(and(eq(leaveRequest.id, id), eq(leaveRequest.userId, userId)))
    .returning()
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
  const userId = await getUserId()
  const [created] = await db
    .insert(clockEvent)
    .values({ userId, type: "in", ...data })
    .returning()
  // Update staff member status to "On shift"
  await db
    .update(staffMember)
    .set({ status: "On shift" })
    .where(and(eq(staffMember.id, data.staffMemberId), eq(staffMember.userId, userId)))
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
  const userId = await getUserId()
  const [created] = await db
    .insert(clockEvent)
    .values({ userId, type: "out", ...data })
    .returning()
  // Update staff member status back to "Off"
  await db
    .update(staffMember)
    .set({ status: "Off" })
    .where(and(eq(staffMember.id, data.staffMemberId), eq(staffMember.userId, userId)))
  revalidatePath("/staff")
  return created
}

export async function getClockEvents(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(clockEvent)
    .where(and(eq(clockEvent.userId, userId), eq(clockEvent.venueId, venueId)))
    .orderBy(desc(clockEvent.createdAt))
    .limit(100)
}
