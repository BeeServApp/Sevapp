"use server"

import { db } from "@/lib/db"
import {
  audit,
  certificate,
  complianceCheck,
  correctiveAction,
  dailyChecklist,
  dailyChecklistRun,
  policyAck,
  riskAssessment,
  riskHazard,
  safetyRecord,
  staffPolicy,
} from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const COMPLIANCE_PATH = "/compliance"

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Adds an interval to today's date based on a frequency keyword, returns ISO date. */
function nextDueFromFrequency(frequency: string): string {
  const d = new Date()
  switch (frequency) {
    case "Daily":
      d.setDate(d.getDate() + 1)
      break
    case "Weekly":
      d.setDate(d.getDate() + 7)
      break
    case "Monthly":
      d.setMonth(d.getMonth() + 1)
      break
    case "Quarterly":
      d.setMonth(d.getMonth() + 3)
      break
    case "6-monthly":
      d.setMonth(d.getMonth() + 6)
      break
    case "Annual":
    default:
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d.toISOString().slice(0, 10)
}

/** Days until an ISO date (negative = overdue). Returns null for unparseable input. */
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
  const start = new Date(todayISO())
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

/* ----------------------------- Safety records ----------------------------- */
// Fire Safety, H&S, Licensing, Property compliance registers.

export async function getSafetyRecords(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(safetyRecord)
    .where(and(eq(safetyRecord.userId, userId), eq(safetyRecord.venueId, venueId)))
    .orderBy(asc(safetyRecord.id))
}

export async function createSafetyRecord(data: {
  venueId: number
  module: string
  name: string
  reference?: string
  owner?: string
  frequency: string
  nextDue?: string
  notes?: string
}) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Record name is required")

  const [created] = await db
    .insert(safetyRecord)
    .values({
      userId,
      venueId: data.venueId,
      module: data.module || "Fire Safety",
      name,
      reference: data.reference?.trim() || null,
      owner: data.owner?.trim() || null,
      frequency: data.frequency || "Annual",
      lastDone: null,
      nextDue: data.nextDue?.trim() || nextDueFromFrequency(data.frequency || "Annual"),
      status: "Due",
      notes: data.notes?.trim() || null,
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

export async function logSafetyRecord(id: number) {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(safetyRecord)
    .where(and(eq(safetyRecord.id, id), eq(safetyRecord.userId, userId)))
  if (!row) throw new Error("Record not found")

  await db
    .update(safetyRecord)
    .set({
      status: "Complete",
      lastDone: todayLabel(),
      nextDue: nextDueFromFrequency(row.frequency),
    })
    .where(and(eq(safetyRecord.id, id), eq(safetyRecord.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function updateSafetyRecord(
  id: number,
  data: {
    module: string
    name: string
    reference?: string
    owner?: string
    frequency: string
    nextDue?: string
    status: string
    notes?: string
  },
) {
  const userId = await getUserId()
  await db
    .update(safetyRecord)
    .set({
      module: data.module,
      name: data.name.trim(),
      reference: data.reference?.trim() || null,
      owner: data.owner?.trim() || null,
      frequency: data.frequency,
      nextDue: data.nextDue?.trim() || null,
      status: data.status,
      notes: data.notes?.trim() || null,
    })
    .where(and(eq(safetyRecord.id, id), eq(safetyRecord.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function deleteSafetyRecord(id: number) {
  const userId = await getUserId()
  await db.delete(safetyRecord).where(and(eq(safetyRecord.id, id), eq(safetyRecord.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* --------------------------- Risk assessments ----------------------------- */

export type RiskAssessmentWithHazards = Awaited<ReturnType<typeof getRiskAssessments>>[number]

export async function getRiskAssessments(venueId: number) {
  const userId = await getUserId()
  const assessments = await db
    .select()
    .from(riskAssessment)
    .where(and(eq(riskAssessment.userId, userId), eq(riskAssessment.venueId, venueId)))
    .orderBy(desc(riskAssessment.id))

  if (assessments.length === 0) return []

  const hazards = await db
    .select()
    .from(riskHazard)
    .where(eq(riskHazard.userId, userId))
    .orderBy(asc(riskHazard.sortOrder), asc(riskHazard.id))

  return assessments.map((a) => ({
    ...a,
    hazards: hazards.filter((h) => h.assessmentId === a.id),
  }))
}

export async function createRiskAssessment(data: {
  venueId: number
  title: string
  area?: string
  assessor?: string
  reviewDate?: string
  hazards: { hazard: string; whoAtRisk?: string; likelihood: number; severity: number; controls?: string }[]
}) {
  const userId = await getUserId()
  const title = data.title.trim()
  if (!title) throw new Error("Assessment title is required")

  const [created] = await db
    .insert(riskAssessment)
    .values({
      userId,
      venueId: data.venueId,
      title,
      area: data.area?.trim() || null,
      assessor: data.assessor?.trim() || null,
      reviewDate: data.reviewDate?.trim() || null,
      status: "Active",
    })
    .returning()

  const cleaned = data.hazards.map((h) => h.hazard.trim()).filter(Boolean)
  if (cleaned.length > 0) {
    await db.insert(riskHazard).values(
      data.hazards
        .filter((h) => h.hazard.trim())
        .map((h, i) => ({
          userId,
          assessmentId: created.id,
          hazard: h.hazard.trim(),
          whoAtRisk: h.whoAtRisk?.trim() || null,
          likelihood: Math.min(5, Math.max(1, h.likelihood || 1)),
          severity: Math.min(5, Math.max(1, h.severity || 1)),
          controls: h.controls?.trim() || null,
          sortOrder: i,
        })),
    )
  }

  revalidatePath(COMPLIANCE_PATH)
  return created
}

export async function updateRiskAssessmentStatus(id: number, status: string) {
  const userId = await getUserId()
  await db
    .update(riskAssessment)
    .set({ status })
    .where(and(eq(riskAssessment.id, id), eq(riskAssessment.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function deleteRiskAssessment(id: number) {
  const userId = await getUserId()
  await db.delete(riskHazard).where(and(eq(riskHazard.assessmentId, id), eq(riskHazard.userId, userId)))
  await db.delete(riskAssessment).where(and(eq(riskAssessment.id, id), eq(riskAssessment.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* ------------------------------ Staff policies ---------------------------- */

export type PolicyWithAcks = Awaited<ReturnType<typeof getPolicies>>[number]

export async function getPolicies(venueId: number) {
  const userId = await getUserId()
  const policies = await db
    .select()
    .from(staffPolicy)
    .where(and(eq(staffPolicy.userId, userId), eq(staffPolicy.venueId, venueId)))
    .orderBy(desc(staffPolicy.id))

  if (policies.length === 0) return []

  const acks = await db.select().from(policyAck).where(eq(policyAck.userId, userId))

  return policies.map((p) => ({
    ...p,
    acks: acks.filter((a) => a.policyId === p.id),
  }))
}

export async function createPolicy(data: {
  venueId: number
  title: string
  category: string
  version?: string
  reviewDate?: string
  content?: string
  fileUrl?: string
}) {
  const userId = await getUserId()
  const title = data.title.trim()
  if (!title) throw new Error("Policy title is required")

  const [created] = await db
    .insert(staffPolicy)
    .values({
      userId,
      venueId: data.venueId,
      title,
      category: data.category || "General",
      version: data.version?.trim() || "1.0",
      reviewDate: data.reviewDate?.trim() || null,
      content: data.content?.trim() || null,
      fileUrl: data.fileUrl?.trim() || null,
      status: "Published",
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

export async function acknowledgePolicy(policyId: number, staffName: string) {
  const userId = await getUserId()
  const name = staffName.trim()
  if (!name) throw new Error("Name is required")
  await db.insert(policyAck).values({ userId, policyId, staffName: name })
  revalidatePath(COMPLIANCE_PATH)
}

export async function deletePolicy(id: number) {
  const userId = await getUserId()
  await db.delete(policyAck).where(and(eq(policyAck.policyId, id), eq(policyAck.userId, userId)))
  await db.delete(staffPolicy).where(and(eq(staffPolicy.id, id), eq(staffPolicy.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* ----------------------------- Daily checklists --------------------------- */

export type ChecklistWithRun = Awaited<ReturnType<typeof getChecklists>>[number]

export async function getChecklists(venueId: number) {
  const userId = await getUserId()
  const lists = await db
    .select()
    .from(dailyChecklist)
    .where(and(eq(dailyChecklist.userId, userId), eq(dailyChecklist.venueId, venueId)))
    .orderBy(asc(dailyChecklist.id))

  if (lists.length === 0) return []

  const iso = todayISO()
  const runs = await db
    .select()
    .from(dailyChecklistRun)
    .where(
      and(
        eq(dailyChecklistRun.userId, userId),
        eq(dailyChecklistRun.venueId, venueId),
        eq(dailyChecklistRun.dateISO, iso),
      ),
    )

  return lists.map((l) => {
    const items: string[] = l.items ? JSON.parse(l.items) : []
    const run = runs.find((r) => r.checklistId === l.id) ?? null
    return { ...l, parsedItems: items, todayRun: run }
  })
}

export async function createChecklist(data: {
  venueId: number
  title: string
  module: string
  timeOfDay?: string
  frequency: string
  items: string[]
}) {
  const userId = await getUserId()
  const title = data.title.trim()
  if (!title) throw new Error("Checklist title is required")
  const items = data.items.map((i) => i.trim()).filter(Boolean)

  const [created] = await db
    .insert(dailyChecklist)
    .values({
      userId,
      venueId: data.venueId,
      title,
      module: data.module || "Opening",
      timeOfDay: data.timeOfDay?.trim() || null,
      frequency: data.frequency || "Daily",
      items: JSON.stringify(items),
      active: true,
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

/** Records progress on today's run of a checklist; creates the run row on first save. */
export async function saveChecklistRun(data: {
  venueId: number
  checklistId: number
  completed: boolean[]
  total: number
  completedBy?: string
  notes?: string
}) {
  const userId = await getUserId()
  const iso = todayISO()
  const doneCount = data.completed.filter(Boolean).length
  const status = doneCount >= data.total && data.total > 0 ? "Complete" : "Pending"

  const [existing] = await db
    .select()
    .from(dailyChecklistRun)
    .where(
      and(
        eq(dailyChecklistRun.userId, userId),
        eq(dailyChecklistRun.checklistId, data.checklistId),
        eq(dailyChecklistRun.dateISO, iso),
      ),
    )

  if (existing) {
    await db
      .update(dailyChecklistRun)
      .set({
        completedItems: JSON.stringify(data.completed),
        totalItems: data.total,
        doneCount,
        status,
        completedBy: data.completedBy?.trim() || existing.completedBy,
        notes: data.notes?.trim() || existing.notes,
        completedAt: status === "Complete" ? new Date() : null,
      })
      .where(and(eq(dailyChecklistRun.id, existing.id), eq(dailyChecklistRun.userId, userId)))
  } else {
    await db.insert(dailyChecklistRun).values({
      userId,
      venueId: data.venueId,
      checklistId: data.checklistId,
      dateISO: iso,
      completedItems: JSON.stringify(data.completed),
      totalItems: data.total,
      doneCount,
      status,
      completedBy: data.completedBy?.trim() || null,
      notes: data.notes?.trim() || null,
      completedAt: status === "Complete" ? new Date() : null,
    })
  }

  revalidatePath(COMPLIANCE_PATH)
}

export async function deleteChecklist(id: number) {
  const userId = await getUserId()
  await db
    .delete(dailyChecklistRun)
    .where(and(eq(dailyChecklistRun.checklistId, id), eq(dailyChecklistRun.userId, userId)))
  await db.delete(dailyChecklist).where(and(eq(dailyChecklist.id, id), eq(dailyChecklist.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* --------------------------------- Audits --------------------------------- */

export async function getAudits(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(audit)
    .where(and(eq(audit.userId, userId), eq(audit.venueId, venueId)))
    .orderBy(desc(audit.id))
}

export async function createAudit(data: {
  venueId: number
  title: string
  module: string
  auditor?: string
  auditDate?: string
}) {
  const userId = await getUserId()
  const title = data.title.trim()
  if (!title) throw new Error("Audit title is required")

  const [created] = await db
    .insert(audit)
    .values({
      userId,
      venueId: data.venueId,
      title,
      module: data.module || "H&S",
      auditor: data.auditor?.trim() || null,
      auditDate: data.auditDate?.trim() || null,
      status: "Scheduled",
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

export async function completeAudit(data: { id: number; score: number; maxScore: number; findings?: string }) {
  const userId = await getUserId()
  await db
    .update(audit)
    .set({
      score: data.score,
      maxScore: data.maxScore || 100,
      findings: data.findings?.trim() || null,
      status: "Complete",
    })
    .where(and(eq(audit.id, data.id), eq(audit.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function deleteAudit(id: number) {
  const userId = await getUserId()
  await db.delete(audit).where(and(eq(audit.id, id), eq(audit.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* ----------------------- Corrective actions (shared) ---------------------- */

export async function getCorrectiveActions(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(correctiveAction)
    .where(and(eq(correctiveAction.userId, userId), eq(correctiveAction.venueId, venueId)))
    .orderBy(desc(correctiveAction.id))
}

export async function createCorrectiveAction(data: {
  venueId: number
  title: string
  description?: string
  priority: string
  assignee?: string
  dueDate?: string
  sourceAuditId?: number
}) {
  const userId = await getUserId()
  const title = data.title.trim()
  if (!title) throw new Error("Action title is required")

  const [created] = await db
    .insert(correctiveAction)
    .values({
      userId,
      venueId: data.venueId,
      title,
      description: data.description?.trim() || null,
      priority: data.priority || "Medium",
      assignee: data.assignee?.trim() || null,
      dueDate: data.dueDate?.trim() || null,
      sourceAuditId: data.sourceAuditId ?? null,
      status: "Open",
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

export async function updateCorrectiveActionStatus(id: number, status: string) {
  const userId = await getUserId()
  await db
    .update(correctiveAction)
    .set({ status, resolvedAt: status === "Resolved" ? new Date() : null })
    .where(and(eq(correctiveAction.id, id), eq(correctiveAction.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function deleteCorrectiveAction(id: number) {
  const userId = await getUserId()
  await db.delete(correctiveAction).where(and(eq(correctiveAction.id, id), eq(correctiveAction.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* --------------------------- Compliance scoring --------------------------- */

export type ComplianceScore = {
  overall: number
  modules: { label: string; score: number; total: number; ok: number }[]
}

/**
 * Computes a 0-100 compliance score from live data across every module.
 * Each module contributes the share of its items that are in a healthy state.
 */
export async function getComplianceScore(venueId: number): Promise<ComplianceScore> {
  const userId = await getUserId()

  const [records, checks, certs, assessments, audits, runs, lists] = await Promise.all([
    db
      .select()
      .from(safetyRecord)
      .where(and(eq(safetyRecord.userId, userId), eq(safetyRecord.venueId, venueId))),
    db
      .select()
      .from(complianceCheck)
      .where(and(eq(complianceCheck.userId, userId), eq(complianceCheck.venueId, venueId))),
    db
      .select()
      .from(certificate)
      .where(and(eq(certificate.userId, userId), eq(certificate.venueId, venueId))),
    db
      .select()
      .from(riskAssessment)
      .where(and(eq(riskAssessment.userId, userId), eq(riskAssessment.venueId, venueId))),
    db.select().from(audit).where(and(eq(audit.userId, userId), eq(audit.venueId, venueId))),
    db
      .select()
      .from(dailyChecklistRun)
      .where(
        and(
          eq(dailyChecklistRun.userId, userId),
          eq(dailyChecklistRun.venueId, venueId),
          eq(dailyChecklistRun.dateISO, todayISO()),
        ),
      ),
    db
      .select()
      .from(dailyChecklist)
      .where(
        and(eq(dailyChecklist.userId, userId), eq(dailyChecklist.venueId, venueId), eq(dailyChecklist.active, true)),
      ),
  ])

  const healthyRecord = (s: string) => s === "Complete" || s === "Valid"
  const recordsOk = records.filter((r) => healthyRecord(r.status)).length
  const checksOk = checks.filter((c) => c.status === "Complete").length
  const certsOk = certs.filter((c) => c.status === "Valid").length
  const assessmentsOk = assessments.filter((a) => a.status === "Active" || a.status === "Complete").length
  const auditsOk = audits.filter((a) => a.status === "Complete").length
  const checklistsDone = runs.filter((r) => r.status === "Complete").length

  const modules = [
    { label: "Safety register", ok: recordsOk, total: records.length },
    { label: "Compliance checks", ok: checksOk, total: checks.length },
    { label: "Certificates", ok: certsOk, total: certs.length },
    { label: "Risk assessments", ok: assessmentsOk, total: assessments.length },
    { label: "Audits", ok: auditsOk, total: audits.length },
    { label: "Today's checklists", ok: checklistsDone, total: lists.length },
  ].map((m) => ({ ...m, score: m.total === 0 ? 100 : Math.round((m.ok / m.total) * 100) }))

  // Overall weighted by item counts; modules with no items don't drag the score.
  const active = modules.filter((m) => m.total > 0)
  const overall =
    active.length === 0
      ? 100
      : Math.round(active.reduce((sum, m) => sum + m.ok, 0) / active.reduce((sum, m) => sum + m.total, 0) * 100)

  return { overall, modules }
}

/* ------------------------------ Notifications ----------------------------- */

export type Notification = {
  id: string
  kind: "overdue" | "expiring" | "checklist" | "action" | "review"
  title: string
  detail: string
  severity: "danger" | "warning" | "info"
  tab: string
}

/**
 * Derives a live notification feed from current data. No table — recomputed on
 * every load so it always reflects reality (overdue items, expiries, due work).
 */
export async function getNotifications(venueId: number): Promise<Notification[]> {
  const userId = await getUserId()

  const [records, certs, checks, assessments, actions, lists, runs] = await Promise.all([
    db
      .select()
      .from(safetyRecord)
      .where(and(eq(safetyRecord.userId, userId), eq(safetyRecord.venueId, venueId))),
    db
      .select()
      .from(certificate)
      .where(and(eq(certificate.userId, userId), eq(certificate.venueId, venueId))),
    db
      .select()
      .from(complianceCheck)
      .where(and(eq(complianceCheck.userId, userId), eq(complianceCheck.venueId, venueId))),
    db
      .select()
      .from(riskAssessment)
      .where(and(eq(riskAssessment.userId, userId), eq(riskAssessment.venueId, venueId))),
    db
      .select()
      .from(correctiveAction)
      .where(and(eq(correctiveAction.userId, userId), eq(correctiveAction.venueId, venueId))),
    db
      .select()
      .from(dailyChecklist)
      .where(
        and(eq(dailyChecklist.userId, userId), eq(dailyChecklist.venueId, venueId), eq(dailyChecklist.active, true)),
      ),
    db
      .select()
      .from(dailyChecklistRun)
      .where(
        and(
          eq(dailyChecklistRun.userId, userId),
          eq(dailyChecklistRun.venueId, venueId),
          eq(dailyChecklistRun.dateISO, todayISO()),
        ),
      ),
  ])

  const out: Notification[] = []

  // Safety register: overdue or due soon by nextDue date, or status flagged.
  for (const r of records) {
    const d = daysUntil(r.nextDue)
    if (r.status === "Overdue" || (d !== null && d < 0)) {
      out.push({
        id: `record-${r.id}`,
        kind: "overdue",
        title: `${r.name} is overdue`,
        detail: `${r.module} · was due ${r.nextDue ?? "—"}`,
        severity: "danger",
        tab: moduleToTab(r.module),
      })
    } else if (d !== null && d <= 14) {
      out.push({
        id: `record-${r.id}`,
        kind: "review",
        title: `${r.name} due soon`,
        detail: `${r.module} · due in ${d} day${d === 1 ? "" : "s"}`,
        severity: "warning",
        tab: moduleToTab(r.module),
      })
    }
  }

  // Certificates expiring / expired.
  for (const c of certs) {
    if (c.status === "Expired") {
      out.push({
        id: `cert-${c.id}`,
        kind: "expiring",
        title: `${c.name} has expired`,
        detail: `${c.authority ?? "Certificate"} · expired ${c.expires ?? "—"}`,
        severity: "danger",
        tab: "certificates",
      })
    } else if (c.status === "Expiring") {
      out.push({
        id: `cert-${c.id}`,
        kind: "expiring",
        title: `${c.name} expiring soon`,
        detail: `${c.authority ?? "Certificate"} · expires ${c.expires ?? "—"}`,
        severity: "warning",
        tab: "certificates",
      })
    }
  }

  // Compliance checks overdue.
  for (const c of checks) {
    if (c.status === "Overdue") {
      out.push({
        id: `check-${c.id}`,
        kind: "overdue",
        title: `${c.name} check overdue`,
        detail: `${c.frequency} · owner ${c.owner ?? "—"}`,
        severity: "danger",
        tab: "checks",
      })
    }
  }

  // Risk assessments needing review.
  for (const a of assessments) {
    const d = daysUntil(a.reviewDate)
    if (a.status === "Under review" || (d !== null && d < 0)) {
      out.push({
        id: `ra-${a.id}`,
        kind: "review",
        title: `${a.title} needs review`,
        detail: `Risk assessment · review ${a.reviewDate ?? "—"}`,
        severity: "warning",
        tab: "risk",
      })
    }
  }

  // Open corrective actions, overdue ones escalate to danger.
  for (const a of actions) {
    if (a.status === "Resolved") continue
    const d = daysUntil(a.dueDate)
    const overdue = d !== null && d < 0
    out.push({
      id: `action-${a.id}`,
      kind: "action",
      title: overdue ? `Action overdue: ${a.title}` : `Open action: ${a.title}`,
      detail: `${a.priority} priority${a.assignee ? ` · ${a.assignee}` : ""}${a.dueDate ? ` · due ${a.dueDate}` : ""}`,
      severity: overdue ? "danger" : "info",
      tab: "audits",
    })
  }

  // Daily checklists not yet completed today.
  for (const l of lists) {
    const run = runs.find((r) => r.checklistId === l.id)
    if (!run || run.status !== "Complete") {
      const done = run?.doneCount ?? 0
      const total = (l.items ? (JSON.parse(l.items) as string[]).length : 0) || run?.totalItems || 0
      out.push({
        id: `checklist-${l.id}`,
        kind: "checklist",
        title: `${l.title} due today`,
        detail: `${l.module}${l.timeOfDay ? ` · ${l.timeOfDay}` : ""} · ${done}/${total} done`,
        severity: "info",
        tab: "checklists",
      })
    }
  }

  const order = { danger: 0, warning: 1, info: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}

function moduleToTab(module: string): string {
  switch (module) {
    case "Fire Safety":
      return "fire"
    case "Licensing":
      return "licensing"
    case "Property":
      return "property"
    default:
      return "overview"
  }
}
