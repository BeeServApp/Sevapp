"use server"

import { revalidatePath } from "next/cache"
import { and, asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { meeting, meetingAction, meterReading, opsDocument, staffMember, venue } from "@/lib/db/schema"
import { getAccountId } from "@/lib/session"
import { notify } from "@/app/actions/notifications"

export type MeetingWithActions = typeof meeting.$inferSelect & {
  actions: (typeof meetingAction.$inferSelect)[]
}

// ── Meetings ─────────────────────────────────────────────────────────────────

/** Recompute a meeting's headline status from its actions + review state. */
function deriveStatus(
  m: typeof meeting.$inferSelect,
  actions: (typeof meetingAction.$inferSelect)[],
): string {
  const today = new Date().toISOString().slice(0, 10)
  const openOverdue = actions.some(
    (a) => a.status !== "Completed" && a.dueDate && a.dueDate < today,
  )
  if (openOverdue) return "Actions Overdue"
  if (m.status === "Pending") return "Pending"
  // A held meeting still awaiting its signature review, past its date.
  if (!m.reviewedAt && m.scheduledDate && m.scheduledDate < today) return "Review Overdue"
  const allActionsDone = actions.length === 0 || actions.every((a) => a.status === "Completed")
  if (m.reviewedAt && allActionsDone) return "Completed"
  return m.status === "Held" ? "Held" : m.status
}

export async function getMeetings(venueId: number): Promise<MeetingWithActions[]> {
  const userId = await getAccountId()
  const rows = await db
    .select()
    .from(meeting)
    .where(and(eq(meeting.userId, userId), eq(meeting.venueId, venueId)))
    .orderBy(desc(meeting.createdAt))

  const acts = await db
    .select()
    .from(meetingAction)
    .where(and(eq(meetingAction.userId, userId), eq(meetingAction.venueId, venueId)))
    .orderBy(asc(meetingAction.createdAt))

  return rows.map((m) => {
    const actions = acts.filter((a) => a.meetingId === m.id)
    return { ...m, status: deriveStatus(m, actions), actions }
  })
}

export async function createMeeting(input: {
  venueId: number
  title: string
  scheduledDate?: string
  createdBy?: string
  /** Preferred: the staff member who created/owns this meeting. */
  createdByStaffMemberId?: number | null
  notes?: string
  /** Optional staff member (with a linked login) to co-assign the meeting to. */
  assignedStaffMemberId?: number | null
  actions?: { title: string; assignee?: string; dueDate?: string }[]
}) {
  const userId = await getAccountId()

  // Resolve the assignee's login so the meeting can surface on their calendar.
  let assignedStaffMemberId: number | null = null
  let assignedUserId: string | null = null
  if (input.assignedStaffMemberId) {
    const [sm] = await db
      .select()
      .from(staffMember)
      .where(and(eq(staffMember.id, input.assignedStaffMemberId), eq(staffMember.userId, userId)))
      .limit(1)
    if (sm) {
      assignedStaffMemberId = sm.id
      assignedUserId = sm.linkedUserId ?? null
    }
  }

  // Resolve the creator: prefer the linked staff member, falling back to the
  // free-text name so existing callers keep working.
  let createdByStaffMemberId: number | null = null
  let createdByName: string | null = input.createdBy?.trim() || null
  if (input.createdByStaffMemberId) {
    const [sm] = await db
      .select()
      .from(staffMember)
      .where(and(eq(staffMember.id, input.createdByStaffMemberId), eq(staffMember.userId, userId)))
      .limit(1)
    if (sm) {
      createdByStaffMemberId = sm.id
      createdByName = sm.name
    }
  }

  const [created] = await db
    .insert(meeting)
    .values({
      userId,
      venueId: input.venueId,
      title: input.title,
      scheduledDate: input.scheduledDate || null,
      createdBy: createdByName,
      createdByStaffMemberId,
      notes: input.notes || null,
      assignedStaffMemberId,
      assignedUserId,
      status: "Pending",
    })
    .returning()

  const cleanActions = (input.actions ?? []).filter((a) => a.title.trim())
  if (cleanActions.length > 0) {
    await db.insert(meetingAction).values(
      cleanActions.map((a) => ({
        userId,
        venueId: input.venueId,
        meetingId: created.id,
        title: a.title.trim(),
        assignee: a.assignee?.trim() || null,
        dueDate: a.dueDate || null,
      })),
    )
  }

  // Notify the assignee (if they have a login) so it pops up in their bell +
  // calendar. Never notify the person creating their own meeting.
  if (assignedUserId) {
    const [sm] = await db
      .select({ email: staffMember.email })
      .from(staffMember)
      .where(eq(staffMember.id, assignedStaffMemberId as number))
      .limit(1)
    const [v] = await db
      .select({ name: venue.name })
      .from(venue)
      .where(eq(venue.id, input.venueId))
      .limit(1)
    const when = input.scheduledDate ? ` on ${input.scheduledDate}` : ""
    await notify({
      accountId: userId,
      recipientUserId: assignedUserId,
      staffMemberId: assignedStaffMemberId,
      kind: "meeting",
      title: `You've been assigned to "${input.title}"`,
      body: `${v?.name ? `${v.name} — ` : ""}Meeting${when}. View it on your calendar.`,
      href: "/calendar",
      email: sm?.email ?? null,
    })
  }

  revalidatePath("/tasks")
  revalidatePath("/calendar")
  return created
}

/** Edit a scheduled meeting's core details (before or after it's started). */
export async function updateMeeting(input: {
  meetingId: number
  title?: string
  scheduledDate?: string | null
  createdByStaffMemberId?: number | null
  /** Free-text creator, e.g. a role like "Owner" or "Area Manager". */
  createdBy?: string | null
  notes?: string | null
  assignedStaffMemberId?: number | null
}) {
  const userId = await getAccountId()

  const patch: Partial<typeof meeting.$inferSelect> = {}
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.scheduledDate !== undefined) patch.scheduledDate = input.scheduledDate || null
  if (input.notes !== undefined) patch.notes = input.notes || null

  if (input.createdByStaffMemberId !== undefined) {
    if (input.createdByStaffMemberId) {
      const [sm] = await db
        .select()
        .from(staffMember)
        .where(and(eq(staffMember.id, input.createdByStaffMemberId), eq(staffMember.userId, userId)))
        .limit(1)
      patch.createdByStaffMemberId = sm ? sm.id : null
      patch.createdBy = sm ? sm.name : null
    } else {
      // Clear the staff link; fall back to any free-text creator provided.
      patch.createdByStaffMemberId = null
      patch.createdBy = input.createdBy?.trim() || null
    }
  } else if (input.createdBy !== undefined) {
    patch.createdBy = input.createdBy?.trim() || null
  }

  if (input.assignedStaffMemberId !== undefined) {
    if (input.assignedStaffMemberId) {
      const [sm] = await db
        .select()
        .from(staffMember)
        .where(and(eq(staffMember.id, input.assignedStaffMemberId), eq(staffMember.userId, userId)))
        .limit(1)
      patch.assignedStaffMemberId = sm ? sm.id : null
      patch.assignedUserId = sm ? sm.linkedUserId ?? null : null
    } else {
      patch.assignedStaffMemberId = null
      patch.assignedUserId = null
    }
  }

  await db
    .update(meeting)
    .set(patch)
    .where(and(eq(meeting.id, input.meetingId), eq(meeting.userId, userId)))
  revalidatePath("/tasks")
  revalidatePath("/calendar")
}

/** Mark a meeting as started, opening its live notes + actions workspace. */
export async function startMeeting(meetingId: number) {
  const userId = await getAccountId()
  const [updated] = await db
    .update(meeting)
    .set({ status: "In Progress", startedAt: new Date() })
    .where(and(eq(meeting.id, meetingId), eq(meeting.userId, userId)))
    .returning()
  revalidatePath("/tasks")
  revalidatePath("/calendar")
  return updated
}

/** Persist live notes captured while a meeting is running. */
export async function updateMeetingNotes(meetingId: number, notes: string) {
  const userId = await getAccountId()
  await db
    .update(meeting)
    .set({ notes: notes || null })
    .where(and(eq(meeting.id, meetingId), eq(meeting.userId, userId)))
  revalidatePath("/tasks")
}

/** Store the captured signature review, marking the meeting reviewed + held. */
export async function signMeeting(input: { meetingId: number; signatureUrl: string; signedBy: string }) {
  const userId = await getAccountId()
  await db
    .update(meeting)
    .set({
      signatureUrl: input.signatureUrl,
      signedBy: input.signedBy,
      signedAt: new Date(),
      reviewedAt: new Date(),
      heldAt: new Date(),
      status: "Held",
    })
    .where(and(eq(meeting.id, input.meetingId), eq(meeting.userId, userId)))
  revalidatePath("/tasks")
}

export async function deleteMeeting(meetingId: number) {
  const userId = await getAccountId()
  await db.delete(meetingAction).where(and(eq(meetingAction.meetingId, meetingId), eq(meetingAction.userId, userId)))
  await db.delete(meeting).where(and(eq(meeting.id, meetingId), eq(meeting.userId, userId)))
  revalidatePath("/tasks")
}

export async function updateMeetingActionStatus(actionId: number, status: string) {
  const userId = await getAccountId()
  await db
    .update(meetingAction)
    .set({ status, completedAt: status === "Completed" ? new Date() : null })
    .where(and(eq(meetingAction.id, actionId), eq(meetingAction.userId, userId)))
  revalidatePath("/tasks")
}

export async function addMeetingAction(input: {
  meetingId: number
  venueId: number
  title: string
  assignee?: string
  dueDate?: string
}) {
  const userId = await getAccountId()
  const [created] = await db
    .insert(meetingAction)
    .values({
      userId,
      venueId: input.venueId,
      meetingId: input.meetingId,
      title: input.title.trim(),
      assignee: input.assignee?.trim() || null,
      dueDate: input.dueDate || null,
    })
    .returning()
  revalidatePath("/tasks")
  return created
}

// ── Meter readings ───────────────────────────────────────────────────────────

export async function getMeterReadings(venueId: number) {
  const userId = await getAccountId()
  return db
    .select()
    .from(meterReading)
    .where(and(eq(meterReading.userId, userId), eq(meterReading.venueId, venueId)))
    .orderBy(desc(meterReading.readingDate), desc(meterReading.createdAt))
}

export async function createMeterReading(input: {
  venueId: number
  meterType: string
  unit: string
  value: number
  readingDate: string
  recordedBy?: string
  notes?: string
}) {
  const userId = await getAccountId()
  const [created] = await db
    .insert(meterReading)
    .values({
      userId,
      venueId: input.venueId,
      meterType: input.meterType,
      unit: input.unit,
      value: input.value,
      readingDate: input.readingDate,
      recordedBy: input.recordedBy?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning()
  revalidatePath("/tasks")
  return created
}

export async function deleteMeterReading(id: number) {
  const userId = await getAccountId()
  await db.delete(meterReading).where(and(eq(meterReading.id, id), eq(meterReading.userId, userId)))
  revalidatePath("/tasks")
}

// ── Documents ────────────────────────────────────────────────────────────────

/** Documents for a venue plus any stored centrally (venueId 0). */
export async function getDocuments(venueId: number) {
  const userId = await getAccountId()
  const rows = await db
    .select()
    .from(opsDocument)
    .where(eq(opsDocument.userId, userId))
    .orderBy(desc(opsDocument.createdAt))
  return rows.filter((d) => d.venueId === 0 || d.venueId === venueId)
}

export async function createDocument(input: {
  venueId: number
  central: boolean
  name: string
  description?: string
  category: string
  fileUrl?: string
  expires?: string
  sharedWith: string
}) {
  const userId = await getAccountId()
  const [created] = await db
    .insert(opsDocument)
    .values({
      userId,
      venueId: input.central ? 0 : input.venueId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      fileUrl: input.fileUrl || null,
      expires: input.expires || null,
      sharedWith: input.sharedWith,
    })
    .returning()
  revalidatePath("/tasks")
  return created
}

export async function deleteDocument(id: number) {
  const userId = await getAccountId()
  await db.delete(opsDocument).where(and(eq(opsDocument.id, id), eq(opsDocument.userId, userId)))
  revalidatePath("/tasks")
}
