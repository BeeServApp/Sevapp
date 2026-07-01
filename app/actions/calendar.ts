"use server"

import { db } from "@/lib/db"
import {
  calendarEvent,
  correctiveAction,
  meeting,
  task,
  taskCheck,
  venueEvent,
} from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const CAL_PATH = "/calendar"

const TYPES = ["event", "task", "booking", "maintenance", "reminder"] as const
const COLORS = ["blue", "amber", "gold", "red", "slate"] as const
const LINK_TYPES = ["event", "task", "taskCheck", "correctiveAction"] as const

export type CalendarLinkType = (typeof LINK_TYPES)[number]

export interface CalendarEventInput {
  venueId: number
  title: string
  description?: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
  allDay: boolean
  type: string
  color: string
  location?: string
  linkType?: CalendarLinkType | null
  linkId?: number | null
  status?: string
}

function clean(value: string | undefined | null) {
  const trimmed = (value ?? "").trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeType(value: string) {
  return (TYPES as readonly string[]).includes(value) ? value : "event"
}

function normalizeColor(value: string) {
  return (COLORS as readonly string[]).includes(value) ? value : "blue"
}

/* ----------------------------- Calendar events ---------------------------- */

export async function getCalendarEvents(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(calendarEvent)
    .where(and(eq(calendarEvent.userId, userId), eq(calendarEvent.venueId, venueId)))
    .orderBy(desc(calendarEvent.date))
}

export async function createCalendarEvent(input: CalendarEventInput) {
  const userId = await getUserId()
  const title = input.title.trim()
  if (!title) throw new Error("Title is required")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("A valid date is required")

  const [created] = await db
    .insert(calendarEvent)
    .values({
      userId,
      venueId: input.venueId,
      title,
      description: clean(input.description),
      date: input.date,
      endDate: clean(input.endDate),
      startTime: input.allDay ? null : clean(input.startTime),
      endTime: input.allDay ? null : clean(input.endTime),
      allDay: input.allDay,
      type: normalizeType(input.type),
      color: normalizeColor(input.color),
      location: clean(input.location),
      linkType: input.linkType ?? null,
      linkId: input.linkId ?? null,
      status: clean(input.status) ?? "Scheduled",
    })
    .returning()

  revalidatePath(CAL_PATH)
  return created
}

export async function updateCalendarEvent(id: number, input: CalendarEventInput) {
  const userId = await getUserId()
  const title = input.title.trim()
  if (!title) throw new Error("Title is required")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("A valid date is required")

  await db
    .update(calendarEvent)
    .set({
      title,
      description: clean(input.description),
      date: input.date,
      endDate: clean(input.endDate),
      startTime: input.allDay ? null : clean(input.startTime),
      endTime: input.allDay ? null : clean(input.endTime),
      allDay: input.allDay,
      type: normalizeType(input.type),
      color: normalizeColor(input.color),
      location: clean(input.location),
      linkType: input.linkType ?? null,
      linkId: input.linkId ?? null,
      status: clean(input.status) ?? "Scheduled",
    })
    .where(and(eq(calendarEvent.id, id), eq(calendarEvent.userId, userId)))

  revalidatePath(CAL_PATH)
}

export async function deleteCalendarEvent(id: number) {
  const userId = await getUserId()
  await db
    .delete(calendarEvent)
    .where(and(eq(calendarEvent.id, id), eq(calendarEvent.userId, userId)))
  revalidatePath(CAL_PATH)
}

/* ------------------------- Linked / dated work items ---------------------- */

const isIso = (value: string | null | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

export interface LinkableItems {
  events: { id: number; name: string; date: string | null; status: string }[]
  tasks: { id: number; title: string; due: string | null; priority: string }[]
  taskChecks: { id: number; title: string; dueDate: string | null; status: string }[]
}

/**
 * Bundles everything the calendar page needs in one round-trip: first-class
 * calendar entries, plus dated task-checks and corrective actions that should
 * surface automatically, plus the lists of existing records a user can link.
 */
export async function getCalendarData(venueId: number) {
  const userId = await getUserId()

  const [events, checks, actions, opsEvents, opsTasks, meetings] = await Promise.all([
    db
      .select()
      .from(calendarEvent)
      .where(and(eq(calendarEvent.userId, userId), eq(calendarEvent.venueId, venueId))),
    db
      .select()
      .from(taskCheck)
      .where(and(eq(taskCheck.userId, userId), eq(taskCheck.venueId, venueId))),
    db
      .select()
      .from(correctiveAction)
      .where(and(eq(correctiveAction.userId, userId), eq(correctiveAction.venueId, venueId))),
    db
      .select()
      .from(venueEvent)
      .where(and(eq(venueEvent.userId, userId), eq(venueEvent.venueId, venueId))),
    db
      .select()
      .from(task)
      .where(and(eq(task.userId, userId), eq(task.venueId, venueId))),
    db
      .select()
      .from(meeting)
      .where(and(eq(meeting.userId, userId), eq(meeting.venueId, venueId))),
  ])

  // task-check / corrective-action ids already linked, so we don't double-show them.
  const linkedKeys = new Set(
    events
      .filter((e) => e.linkType && e.linkId != null)
      .map((e) => `${e.linkType}:${e.linkId}`),
  )

  const datedChecks = checks
    .filter((c) => isIso(c.dueDate) && !linkedKeys.has(`taskCheck:${c.id}`))
    .map((c) => ({
      id: c.id,
      title: c.title,
      dueDate: c.dueDate as string,
      dueTime: c.dueTime ?? null,
      status: c.status,
      priority: c.priority,
    }))

  const datedActions = actions
    .filter((a) => isIso(a.dueDate) && !linkedKeys.has(`correctiveAction:${a.id}`))
    .map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate as string,
      status: a.status,
      priority: a.priority,
    }))

  // Meetings scheduled from Task Management surface on the calendar automatically.
  const datedMeetings = meetings
    .filter((m) => isIso(m.scheduledDate) && !linkedKeys.has(`meeting:${m.id}`))
    .map((m) => ({
      id: m.id,
      title: m.title,
      scheduledDate: m.scheduledDate as string,
      status: m.status,
    }))

  const linkable: LinkableItems = {
    events: opsEvents.map((e) => ({ id: e.id, name: e.name, date: e.date, status: e.status })),
    tasks: opsTasks.map((t) => ({ id: t.id, title: t.title, due: t.due, priority: t.priority })),
    taskChecks: checks.map((c) => ({
      id: c.id,
      title: c.title,
      dueDate: c.dueDate,
      status: c.status,
    })),
  }

  return { events, datedChecks, datedActions, datedMeetings, linkable }
}
