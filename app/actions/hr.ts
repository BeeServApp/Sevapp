"use server"

import { db } from "@/lib/db"
import { onboarding, onboardingTask, hrDocument, staffMember } from "@/lib/db/schema"
import { getAccountId, getCurrentUser, requireOwner } from "@/lib/session"
import { emitChange } from "@/lib/realtime"
import { notify } from "@/app/actions/notifications"
import { DEFAULT_CHECKLIST_TEMPLATE, missingRequiredFields } from "@/lib/hr"
import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Columns a caller is allowed to write to the onboarding record. Anything not
// listed here (id, userId, venueId, status, timestamps) is managed server-side.
const EDITABLE_FIELDS = [
  "legalFirstName",
  "legalLastName",
  "preferredName",
  "dob",
  "nationality",
  "addressLine1",
  "addressLine2",
  "city",
  "postcode",
  "personalEmail",
  "personalPhone",
  "nationalInsuranceNumber",
  "rightToWorkType",
  "rightToWorkShareCode",
  "rightToWorkDocUrl",
  "rightToWorkExpiry",
  "starterDeclaration",
  "studentLoanPlan",
  "postgradLoan",
  "taxCode",
  "bankName",
  "accountName",
  "sortCode",
  "accountNumber",
  "pensionOptOut",
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
  "jobTitle",
  "startDate",
  "payType",
  "payRatePence",
  "holidayEntitlementDays",
  "probationEndDate",
  "reviewDueDate",
] as const

export type OnboardingInput = Partial<Record<(typeof EDITABLE_FIELDS)[number], unknown>>

function pickEditable(input: OnboardingInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in input && input[key] !== undefined) out[key] = input[key]
  }
  return out
}

// ── Onboarding: owner side ────────────────────────────────────────────────

/** All onboarding records for a venue, keyed for the owner console. */
export async function getOnboardingRecords(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(onboarding)
    .where(and(eq(onboarding.userId, accountId), eq(onboarding.venueId, venueId)))
    .orderBy(asc(onboarding.id))
}

export async function getOnboardingForStaff(staffMemberId: number) {
  const accountId = await getAccountId()
  const [row] = await db
    .select()
    .from(onboarding)
    .where(and(eq(onboarding.userId, accountId), eq(onboarding.staffMemberId, staffMemberId)))
    .limit(1)
  return row ?? null
}

/**
 * Ensures an onboarding record + default checklist exist for a staff member,
 * then returns it. Idempotent — safe to call whenever the owner opens a hire.
 */
export async function ensureOnboarding(venueId: number, staffMemberId: number) {
  const me = await requireOwner()

  const existing = await db
    .select()
    .from(onboarding)
    .where(
      and(eq(onboarding.userId, me.accountId), eq(onboarding.staffMemberId, staffMemberId)),
    )
    .limit(1)
  if (existing[0]) return existing[0]

  // Prefill name/job title from the existing staff record where possible.
  const [member] = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.id, staffMemberId), eq(staffMember.userId, me.accountId)))
    .limit(1)

  const [nameFirst, ...rest] = (member?.name ?? "").split(" ")

  const [created] = await db
    .insert(onboarding)
    .values({
      userId: me.accountId,
      venueId,
      staffMemberId,
      legalFirstName: nameFirst || null,
      legalLastName: rest.join(" ") || null,
      jobTitle: member?.role ?? null,
      personalEmail: member?.email ?? null,
      personalPhone: member?.phone ?? null,
      status: "not_started",
    })
    .returning()

  // Seed the default UK checklist for this hire.
  await db.insert(onboardingTask).values(
    DEFAULT_CHECKLIST_TEMPLATE.map((t, i) => ({
      userId: me.accountId,
      venueId,
      staffMemberId,
      label: t.label,
      category: t.category,
      sortOrder: i,
    })),
  )

  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return created
}

/** Owner saves onboarding details for a hire (partial patch). */
export async function saveOnboarding(staffMemberId: number, input: OnboardingInput) {
  const me = await requireOwner()
  const patch = pickEditable(input)

  const [updated] = await db
    .update(onboarding)
    .set({
      ...patch,
      status: "in_progress",
      updatedAt: new Date(),
    })
    .where(
      and(eq(onboarding.userId, me.accountId), eq(onboarding.staffMemberId, staffMemberId)),
    )
    .returning()

  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return updated
}

/** Owner marks the Right to Work check as verified. */
export async function setRightToWorkChecked(staffMemberId: number, checked: boolean) {
  const me = await requireOwner()
  const [updated] = await db
    .update(onboarding)
    .set({ rightToWorkChecked: checked, updatedAt: new Date() })
    .where(
      and(eq(onboarding.userId, me.accountId), eq(onboarding.staffMemberId, staffMemberId)),
    )
    .returning()
  revalidatePath("/staff")
  return updated
}

/** Owner approves onboarding — blocked until statutory fields are present. */
export async function approveOnboarding(staffMemberId: number) {
  const me = await requireOwner()
  const [record] = await db
    .select()
    .from(onboarding)
    .where(
      and(eq(onboarding.userId, me.accountId), eq(onboarding.staffMemberId, staffMemberId)),
    )
    .limit(1)
  if (!record) throw new Error("Onboarding record not found")

  const missing = missingRequiredFields(record as Record<string, unknown>)
  if (missing.length > 0) {
    return { ok: false as const, missing }
  }

  const [updated] = await db
    .update(onboarding)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(onboarding.userId, me.accountId), eq(onboarding.staffMemberId, staffMemberId)),
    )
    .returning()

  await emitChange(me.accountId, "all")
  revalidatePath("/staff")
  return { ok: true as const, record: updated }
}

// ── Onboarding: staff self-service ────────────────────────────────────────

/** Staff read their own onboarding record (created lazily by the owner). */
export async function getMyOnboarding() {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) return null
  const [row] = await db
    .select()
    .from(onboarding)
    .where(
      and(eq(onboarding.userId, me.accountId), eq(onboarding.staffMemberId, me.staffMemberId)),
    )
    .limit(1)
  return row ?? null
}

/** Staff save their own onboarding details. */
export async function saveMyOnboarding(input: OnboardingInput) {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) throw new Error("Not a staff account")
  const patch = pickEditable(input)

  const [updated] = await db
    .update(onboarding)
    .set({ ...patch, status: "in_progress", updatedAt: new Date() })
    .where(
      and(
        eq(onboarding.userId, me.accountId),
        eq(onboarding.staffMemberId, me.staffMemberId),
      ),
    )
    .returning()
  revalidatePath("/staff")
  return updated
}

/** Staff submit their completed form to the owner for approval. */
export async function submitMyOnboarding() {
  const me = await getCurrentUser()
  if (me.staffMemberId == null) throw new Error("Not a staff account")

  const [record] = await db
    .select()
    .from(onboarding)
    .where(
      and(
        eq(onboarding.userId, me.accountId),
        eq(onboarding.staffMemberId, me.staffMemberId),
      ),
    )
    .limit(1)
  if (!record) throw new Error("No onboarding record")

  const missing = missingRequiredFields(record as Record<string, unknown>)
  if (missing.length > 0) return { ok: false as const, missing }

  await db
    .update(onboarding)
    .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(onboarding.userId, me.accountId),
        eq(onboarding.staffMemberId, me.staffMemberId),
      ),
    )

  // Let the owner know there is a submission to review.
  await notify({
    accountId: me.accountId,
    recipientUserId: me.accountId,
    staffMemberId: me.staffMemberId,
    kind: "hr",
    title: "Onboarding submitted",
    body: `${me.name} has completed their onboarding form for review.`,
    href: "/staff",
  }).catch(() => {})

  revalidatePath("/staff")
  return { ok: true as const }
}

// ── Onboarding checklist ──────────────────────────────────────────────────

export async function getOnboardingTasks(staffMemberId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(onboardingTask)
    .where(
      and(
        eq(onboardingTask.userId, accountId),
        eq(onboardingTask.staffMemberId, staffMemberId),
      ),
    )
    .orderBy(asc(onboardingTask.sortOrder), asc(onboardingTask.id))
}

export async function toggleOnboardingTask(id: number, done: boolean) {
  const me = await requireOwner()
  const [updated] = await db
    .update(onboardingTask)
    .set({ done, doneAt: done ? new Date() : null })
    .where(and(eq(onboardingTask.id, id), eq(onboardingTask.userId, me.accountId)))
    .returning()
  revalidatePath("/staff")
  return updated
}

export async function addOnboardingTask(input: {
  venueId: number
  staffMemberId: number
  label: string
  category?: string
}) {
  const me = await requireOwner()
  const [created] = await db
    .insert(onboardingTask)
    .values({
      userId: me.accountId,
      venueId: input.venueId,
      staffMemberId: input.staffMemberId,
      label: input.label,
      category: input.category ?? "general",
      sortOrder: 999,
    })
    .returning()
  revalidatePath("/staff")
  return created
}

export async function deleteOnboardingTask(id: number) {
  const me = await requireOwner()
  await db
    .delete(onboardingTask)
    .where(and(eq(onboardingTask.id, id), eq(onboardingTask.userId, me.accountId)))
  revalidatePath("/staff")
}

// ── HR documents ──────────────────────────────────────────────────────────

/** All documents for a venue. staffMemberId 0 = company-wide. */
export async function getHrDocuments(venueId: number) {
  const accountId = await getAccountId()
  return db
    .select()
    .from(hrDocument)
    .where(and(eq(hrDocument.userId, accountId), eq(hrDocument.venueId, venueId)))
    .orderBy(asc(hrDocument.id))
}

export async function addHrDocument(input: {
  venueId: number
  staffMemberId?: number
  name: string
  category?: string
  fileUrl?: string | null
  issuedDate?: string | null
  expiryDate?: string | null
  notes?: string | null
}) {
  const me = await requireOwner()
  const [created] = await db
    .insert(hrDocument)
    .values({
      userId: me.accountId,
      venueId: input.venueId,
      staffMemberId: input.staffMemberId ?? 0,
      name: input.name,
      category: input.category ?? "other",
      fileUrl: input.fileUrl ?? null,
      issuedDate: input.issuedDate ?? null,
      expiryDate: input.expiryDate ?? null,
      notes: input.notes ?? null,
    })
    .returning()
  revalidatePath("/staff")
  return created
}

export async function deleteHrDocument(id: number) {
  const me = await requireOwner()
  await db
    .delete(hrDocument)
    .where(and(eq(hrDocument.id, id), eq(hrDocument.userId, me.accountId)))
  revalidatePath("/staff")
}
