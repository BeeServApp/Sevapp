"use server"

import { db } from "@/lib/db"
import {
  staffMember,
  trainingAssignment,
  trainingLesson,
  trainingModule,
  trainingProgress,
} from "@/lib/db/schema"
import { getAccountId, getCurrentUser, requireOwner } from "@/lib/session"
import { isAssignedTo, roleToGroup, type AudienceValue } from "@/lib/training"
import { and, asc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const TRAINING_PATH = "/training"

/* --------------------------------- Types ---------------------------------- */

export type ModuleWithDetails = Awaited<ReturnType<typeof getModulesWithDetails>>[number]
export type MyTrainingModule = Awaited<ReturnType<typeof getMyTraining>>[number]
export type AssignStaffOption = { id: number; name: string; role: string; group: AudienceValue }

/* ------------------------------- Owner reads ------------------------------ */

/** Full module list with lessons and assignments (owner management view). */
export async function getModulesWithDetails() {
  const userId = await getAccountId()

  const modules = await db
    .select()
    .from(trainingModule)
    .where(eq(trainingModule.userId, userId))
    .orderBy(asc(trainingModule.sortOrder), asc(trainingModule.id))

  if (modules.length === 0) return []

  const moduleIds = modules.map((m) => m.id)

  const [lessons, assignments, progress, staff] = await Promise.all([
    db
      .select()
      .from(trainingLesson)
      .where(and(eq(trainingLesson.userId, userId), inArray(trainingLesson.moduleId, moduleIds)))
      .orderBy(asc(trainingLesson.sortOrder), asc(trainingLesson.id)),
    db
      .select()
      .from(trainingAssignment)
      .where(and(eq(trainingAssignment.userId, userId), inArray(trainingAssignment.moduleId, moduleIds))),
    db.select().from(trainingProgress).where(eq(trainingProgress.userId, userId)),
    db.select().from(staffMember).where(eq(staffMember.userId, userId)),
  ])

  return modules.map((m) => {
    const moduleLessons = lessons.filter((l) => l.moduleId === m.id)
    const moduleAssignments = assignments.filter((a) => a.moduleId === m.id)
    const assignedStaff = staff.filter((s) =>
      isAssignedTo(moduleAssignments, { id: s.id, role: s.role }),
    )

    // Completion across all assigned staff (avg % of lessons completed).
    const totalLessons = moduleLessons.length
    let sumPct = 0
    for (const s of assignedStaff) {
      const done = progress.filter((p) => p.staffMemberId === s.id && p.moduleId === m.id).length
      sumPct += totalLessons === 0 ? 0 : done / totalLessons
    }
    const completionPct =
      assignedStaff.length === 0 ? 0 : Math.round((sumPct / assignedStaff.length) * 100)

    return {
      ...m,
      lessons: moduleLessons,
      assignments: moduleAssignments,
      assignedCount: assignedStaff.length,
      completionPct,
    }
  })
}

/** Staff options for the assignment picker. */
export async function getStaffForAssignment(): Promise<AssignStaffOption[]> {
  const userId = await getAccountId()
  const staff = await db
    .select({ id: staffMember.id, name: staffMember.name, role: staffMember.role })
    .from(staffMember)
    .where(eq(staffMember.userId, userId))
    .orderBy(asc(staffMember.name))

  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role ?? "Staff",
    group: roleToGroup(s.role),
  }))
}

/* ------------------------------ Owner writes ------------------------------ */

export async function createModule(data: {
  title: string
  description?: string
  category: string
}) {
  await requireOwner()
  const userId = await getAccountId()
  const title = data.title.trim()
  if (!title) throw new Error("Module title is required")

  const [created] = await db
    .insert(trainingModule)
    .values({
      userId,
      title,
      description: data.description?.trim() || null,
      category: data.category.trim() || "General",
      status: "Published",
    })
    .returning()

  revalidatePath(TRAINING_PATH)
  return created
}

export async function updateModule(
  id: number,
  data: { title?: string; description?: string; category?: string; status?: string },
) {
  await requireOwner()
  const userId = await getAccountId()

  await db
    .update(trainingModule)
    .set({
      ...(data.title != null ? { title: data.title.trim() } : {}),
      ...(data.description != null ? { description: data.description.trim() || null } : {}),
      ...(data.category != null ? { category: data.category.trim() || "General" } : {}),
      ...(data.status != null ? { status: data.status } : {}),
    })
    .where(and(eq(trainingModule.id, id), eq(trainingModule.userId, userId)))

  revalidatePath(TRAINING_PATH)
}

export async function deleteModule(id: number) {
  await requireOwner()
  const userId = await getAccountId()
  await db
    .delete(trainingProgress)
    .where(and(eq(trainingProgress.moduleId, id), eq(trainingProgress.userId, userId)))
  await db
    .delete(trainingAssignment)
    .where(and(eq(trainingAssignment.moduleId, id), eq(trainingAssignment.userId, userId)))
  await db
    .delete(trainingLesson)
    .where(and(eq(trainingLesson.moduleId, id), eq(trainingLesson.userId, userId)))
  await db.delete(trainingModule).where(and(eq(trainingModule.id, id), eq(trainingModule.userId, userId)))
  revalidatePath(TRAINING_PATH)
}

export async function createLesson(data: {
  moduleId: number
  title: string
  type: string
  url?: string
  content?: string
  durationMin?: number | null
}) {
  await requireOwner()
  const userId = await getAccountId()
  const title = data.title.trim()
  if (!title) throw new Error("Lesson title is required")

  // Place new lessons at the end of the module.
  const siblings = await db
    .select({ sortOrder: trainingLesson.sortOrder })
    .from(trainingLesson)
    .where(and(eq(trainingLesson.userId, userId), eq(trainingLesson.moduleId, data.moduleId)))
  const nextOrder = siblings.reduce((max, s) => Math.max(max, s.sortOrder), 0) + 1

  const [created] = await db
    .insert(trainingLesson)
    .values({
      userId,
      moduleId: data.moduleId,
      title,
      type: data.type === "document" ? "document" : "video",
      url: data.url?.trim() || null,
      content: data.content?.trim() || null,
      durationMin: data.durationMin ?? null,
      sortOrder: nextOrder,
    })
    .returning()

  revalidatePath(TRAINING_PATH)
  return created
}

export async function deleteLesson(id: number) {
  await requireOwner()
  const userId = await getAccountId()
  await db
    .delete(trainingProgress)
    .where(and(eq(trainingProgress.lessonId, id), eq(trainingProgress.userId, userId)))
  await db.delete(trainingLesson).where(and(eq(trainingLesson.id, id), eq(trainingLesson.userId, userId)))
  revalidatePath(TRAINING_PATH)
}

export async function assignModule(data: {
  moduleId: number
  audience?: AudienceValue
  staffMemberId?: number | null
  dueDate?: string
}) {
  const me = await requireOwner()
  const userId = await getAccountId()

  const audience = data.staffMemberId ? "individual" : data.audience ?? "everyone"

  // Avoid duplicate assignments for the same target.
  const existing = await db
    .select()
    .from(trainingAssignment)
    .where(
      and(eq(trainingAssignment.userId, userId), eq(trainingAssignment.moduleId, data.moduleId)),
    )
  const dupe = existing.find((a) =>
    data.staffMemberId
      ? a.staffMemberId === data.staffMemberId
      : a.audience === audience && a.staffMemberId == null,
  )
  if (dupe) {
    if (data.dueDate !== undefined) {
      await db
        .update(trainingAssignment)
        .set({ dueDate: data.dueDate?.trim() || null })
        .where(eq(trainingAssignment.id, dupe.id))
      revalidatePath(TRAINING_PATH)
    }
    return dupe
  }

  const [created] = await db
    .insert(trainingAssignment)
    .values({
      userId,
      moduleId: data.moduleId,
      audience,
      staffMemberId: data.staffMemberId ?? null,
      dueDate: data.dueDate?.trim() || null,
      assignedBy: me.name,
    })
    .returning()

  revalidatePath(TRAINING_PATH)
  return created
}

export async function removeAssignment(id: number) {
  await requireOwner()
  const userId = await getAccountId()
  await db
    .delete(trainingAssignment)
    .where(and(eq(trainingAssignment.id, id), eq(trainingAssignment.userId, userId)))
  revalidatePath(TRAINING_PATH)
}

/* ---------------------------- Staff experience ---------------------------- */

/**
 * Returns the modules assigned to the currently logged-in staff member, each
 * with its lessons and the caller's per-lesson completion. Owners get an empty
 * list here (they manage rather than complete training).
 */
export async function getMyTraining() {
  const me = await getCurrentUser()
  const userId = me.accountId
  if (me.staffMemberId == null) return []

  const [self] = await db
    .select({ id: staffMember.id, role: staffMember.role })
    .from(staffMember)
    .where(and(eq(staffMember.id, me.staffMemberId), eq(staffMember.userId, userId)))
    .limit(1)
  if (!self) return []

  const modules = await db
    .select()
    .from(trainingModule)
    .where(and(eq(trainingModule.userId, userId), eq(trainingModule.status, "Published")))
    .orderBy(asc(trainingModule.sortOrder), asc(trainingModule.id))
  if (modules.length === 0) return []

  const moduleIds = modules.map((m) => m.id)

  const [lessons, assignments, myProgress] = await Promise.all([
    db
      .select()
      .from(trainingLesson)
      .where(and(eq(trainingLesson.userId, userId), inArray(trainingLesson.moduleId, moduleIds)))
      .orderBy(asc(trainingLesson.sortOrder), asc(trainingLesson.id)),
    db
      .select()
      .from(trainingAssignment)
      .where(and(eq(trainingAssignment.userId, userId), inArray(trainingAssignment.moduleId, moduleIds))),
    db
      .select()
      .from(trainingProgress)
      .where(and(eq(trainingProgress.userId, userId), eq(trainingProgress.staffMemberId, self.id))),
  ])

  return modules
    .filter((m) => {
      const ma = assignments.filter((a) => a.moduleId === m.id)
      return isAssignedTo(ma, { id: self.id, role: self.role })
    })
    .map((m) => {
      const moduleLessons = lessons.filter((l) => l.moduleId === m.id)
      const doneIds = new Set(
        myProgress.filter((p) => p.moduleId === m.id).map((p) => p.lessonId),
      )
      const assignment = assignments.find((a) => a.moduleId === m.id && a.dueDate) ?? null
      return {
        ...m,
        dueDate: assignment?.dueDate ?? null,
        lessons: moduleLessons.map((l) => ({ ...l, completed: doneIds.has(l.id) })),
        completedCount: moduleLessons.filter((l) => doneIds.has(l.id)).length,
        totalCount: moduleLessons.length,
      }
    })
}

/** Marks a single lesson complete/incomplete for the current staff member. */
export async function toggleLesson(lessonId: number, moduleId: number, completed: boolean) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) throw new Error("Only staff can track training progress")
  const userId = me.accountId

  // Guard: the lesson must belong to this account.
  const [lesson] = await db
    .select({ id: trainingLesson.id })
    .from(trainingLesson)
    .where(and(eq(trainingLesson.id, lessonId), eq(trainingLesson.userId, userId)))
    .limit(1)
  if (!lesson) throw new Error("Lesson not found")

  if (completed) {
    const existing = await db
      .select({ id: trainingProgress.id })
      .from(trainingProgress)
      .where(
        and(
          eq(trainingProgress.userId, userId),
          eq(trainingProgress.staffMemberId, me.staffMemberId),
          eq(trainingProgress.lessonId, lessonId),
        ),
      )
      .limit(1)
    if (!existing[0]) {
      await db.insert(trainingProgress).values({
        userId,
        staffMemberId: me.staffMemberId,
        moduleId,
        lessonId,
      })
    }
  } else {
    await db
      .delete(trainingProgress)
      .where(
        and(
          eq(trainingProgress.userId, userId),
          eq(trainingProgress.staffMemberId, me.staffMemberId),
          eq(trainingProgress.lessonId, lessonId),
        ),
      )
  }

  revalidatePath(TRAINING_PATH)
}

/* -------------------------------- Seeding --------------------------------- */

/** Seeds a starter catalogue so the platform feels live on first open. */
export async function seedStarterTraining() {
  await requireOwner()
  const userId = await getAccountId()

  const existing = await db
    .select({ id: trainingModule.id })
    .from(trainingModule)
    .where(eq(trainingModule.userId, userId))
  if (existing.length > 0) return

  for (const [i, m] of STARTER_MODULES.entries()) {
    const [mod] = await db
      .insert(trainingModule)
      .values({
        userId,
        title: m.title,
        description: m.description,
        category: m.category,
        status: "Published",
        sortOrder: i + 1,
      })
      .returning()

    await db.insert(trainingLesson).values(
      m.lessons.map((l, j) => ({
        userId,
        moduleId: mod.id,
        title: l.title,
        type: l.type,
        url: l.url ?? null,
        content: l.content ?? null,
        durationMin: l.durationMin ?? null,
        sortOrder: j + 1,
      })),
    )
  }

  revalidatePath(TRAINING_PATH)
}

type StarterLesson = {
  title: string
  type: "video" | "document"
  url?: string
  content?: string
  durationMin?: number
}

const STARTER_MODULES: Array<{
  title: string
  description: string
  category: string
  lessons: StarterLesson[]
}> = [
  {
    title: "Cellar Management Fundamentals",
    description: "Line cleaning, cask conditioning, gas safety and stock rotation for a healthy cellar.",
    category: "Cellar Management",
    lessons: [
      {
        title: "Cellar cooling & temperature control",
        type: "video",
        url: "https://www.youtube.com/watch?v=1La4QzGeaaQ",
        durationMin: 8,
      },
      {
        title: "Beer line cleaning walkthrough",
        type: "video",
        url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        durationMin: 12,
      },
      {
        title: "Cellar SOP & safety checklist",
        type: "document",
        content:
          "Daily cellar routine:\n\n1. Check and log cellar temperature (11–13°C).\n2. Inspect CO2/mixed gas lines and cylinders — no hissing, valves secure.\n3. Vent and tilt casks ready for service.\n4. Rotate stock front-to-back (FIFO); note best-before dates.\n5. Clean beer lines every 7 days and after every cask change.\n6. Record cleaning date and initials in the cellar log.\n\nGas safety: cylinders chained upright, gas detector armed, never enter a cellar if the alarm sounds.",
      },
    ],
  },
  {
    title: "Food Training & Hygiene",
    description: "Food safety, allergen awareness and kitchen prep standards for kitchen staff.",
    category: "Food Training",
    lessons: [
      {
        title: "Food hygiene essentials",
        type: "video",
        url: "https://www.youtube.com/watch?v=Ct-lOOUqmyY",
        durationMin: 10,
      },
      {
        title: "The 14 allergens explained",
        type: "document",
        content:
          "UK law requires you to know the 14 named allergens: celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, tree nuts, peanuts, sesame, soybeans, and sulphur dioxide/sulphites.\n\nAlways:\n- Check the allergen matrix before serving.\n- Never guess — confirm with the kitchen.\n- Avoid cross-contamination: separate boards, clean hands, fresh utensils.\n- Record any customer allergen request and repeat it back.",
      },
      {
        title: "Cross-contamination & colour coding",
        type: "video",
        url: "https://www.youtube.com/watch?v=1La4QzGeaaQ",
        durationMin: 6,
      },
    ],
  },
  {
    title: "Bar Service & Cocktails",
    description: "Perfect pours, cocktail method and responsible service behind the bar.",
    category: "Bar Service",
    lessons: [
      {
        title: "Pulling the perfect pint",
        type: "video",
        url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        durationMin: 7,
      },
      {
        title: "Classic cocktail methods",
        type: "video",
        url: "https://www.youtube.com/watch?v=Ct-lOOUqmyY",
        durationMin: 15,
      },
      {
        title: "Responsible service of alcohol",
        type: "document",
        content:
          "Licensing responsibilities:\n\n- Challenge 25: ask for ID from anyone who looks under 25. Accept passport, photo driving licence or PASS-hologram card only.\n- Never serve someone who is clearly intoxicated.\n- Never serve alcohol to under-18s or make a proxy sale.\n- Log any refused sale in the refusals register.\n\nA breach can cost the venue its licence and result in a personal fine.",
      },
    ],
  },
  {
    title: "Health, Safety & Compliance",
    description: "Fire safety, manual handling and incident reporting for every team member.",
    category: "Health & Safety",
    lessons: [
      {
        title: "Fire safety & evacuation",
        type: "video",
        url: "https://www.youtube.com/watch?v=1La4QzGeaaQ",
        durationMin: 9,
      },
      {
        title: "Manual handling basics",
        type: "video",
        url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        durationMin: 5,
      },
      {
        title: "Accident & incident reporting",
        type: "document",
        content:
          "If an accident happens:\n\n1. Make the area safe and give first aid if trained.\n2. Tell a manager immediately.\n3. Record it in the accident book with date, time, people involved and what happened.\n4. Report RIDDOR-notifiable incidents to the duty manager the same day.\n5. Keep the scene untouched if the injury is serious.",
      },
    ],
  },
]
