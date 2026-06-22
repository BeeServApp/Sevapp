"use server"

import { db } from "@/lib/db"
import { foodCheck, foodCheckLog, foodPolicy } from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { tempToTenths, tenthsToTemp } from "@/lib/food"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const FOOD_PATH = "/food"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Evaluates whether a reading (tenths) sits inside an optional min/max range (tenths). */
function evaluatePass(
  reading: number | null,
  minTemp: number | null,
  maxTemp: number | null,
): boolean {
  if (reading === null) return true
  if (minTemp !== null && reading < minTemp) return false
  if (maxTemp !== null && reading > maxTemp) return false
  return true
}

/* --------------------------------- Checks --------------------------------- */

export type FoodCheckWithLog = Awaited<ReturnType<typeof getFoodChecks>>[number]

export async function getFoodChecks(venueId: number) {
  const userId = await getUserId()
  const checks = await db
    .select()
    .from(foodCheck)
    .where(and(eq(foodCheck.userId, userId), eq(foodCheck.venueId, venueId)))
    .orderBy(asc(foodCheck.sortOrder), asc(foodCheck.id))

  if (checks.length === 0) return []

  const iso = todayISO()
  const logs = await db
    .select()
    .from(foodCheckLog)
    .where(
      and(
        eq(foodCheckLog.userId, userId),
        eq(foodCheckLog.venueId, venueId),
        eq(foodCheckLog.dateISO, iso),
      ),
    )

  return checks.map((c) => ({
    ...c,
    todayLog: logs.find((l) => l.checkId === c.id) ?? null,
  }))
}

export async function createFoodCheck(data: {
  venueId: number
  name: string
  area: string
  type: string
  minTemp?: number | null
  maxTemp?: number | null
  frequency: string
  timeOfDay?: string
}) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Check name is required")

  const isTemp = data.type === "Temperature"
  const [created] = await db
    .insert(foodCheck)
    .values({
      userId,
      venueId: data.venueId,
      name,
      area: data.area || "Fridge",
      type: data.type || "Temperature",
      minTemp: isTemp && data.minTemp != null ? tempToTenths(data.minTemp) : null,
      maxTemp: isTemp && data.maxTemp != null ? tempToTenths(data.maxTemp) : null,
      frequency: data.frequency || "Daily",
      timeOfDay: data.timeOfDay?.trim() || null,
      active: true,
    })
    .returning()

  revalidatePath(FOOD_PATH)
  return created
}

export async function deleteFoodCheck(id: number) {
  const userId = await getUserId()
  await db.delete(foodCheckLog).where(and(eq(foodCheckLog.checkId, id), eq(foodCheckLog.userId, userId)))
  await db.delete(foodCheck).where(and(eq(foodCheck.id, id), eq(foodCheck.userId, userId)))
  revalidatePath(FOOD_PATH)
}

/** Records or updates today's log for a check; auto-evaluates pass/fail for temperature checks. */
export async function logFoodCheck(data: {
  venueId: number
  checkId: number
  tempReading?: number | null
  passed?: boolean
  correctiveAction?: string
  loggedBy?: string
  notes?: string
}) {
  const userId = await getUserId()
  const iso = todayISO()

  const [check] = await db
    .select()
    .from(foodCheck)
    .where(and(eq(foodCheck.id, data.checkId), eq(foodCheck.userId, userId)))
  if (!check) throw new Error("Check not found")

  const readingTenths =
    check.type === "Temperature" && data.tempReading != null ? tempToTenths(data.tempReading) : null

  const passed =
    check.type === "Temperature"
      ? evaluatePass(readingTenths, check.minTemp, check.maxTemp)
      : data.passed ?? true

  const [existing] = await db
    .select()
    .from(foodCheckLog)
    .where(
      and(
        eq(foodCheckLog.userId, userId),
        eq(foodCheckLog.checkId, data.checkId),
        eq(foodCheckLog.dateISO, iso),
      ),
    )

  const values = {
    tempReading: readingTenths,
    passed,
    correctiveAction: data.correctiveAction?.trim() || null,
    loggedBy: data.loggedBy?.trim() || null,
    notes: data.notes?.trim() || null,
  }

  if (existing) {
    await db
      .update(foodCheckLog)
      .set(values)
      .where(and(eq(foodCheckLog.id, existing.id), eq(foodCheckLog.userId, userId)))
  } else {
    await db.insert(foodCheckLog).values({
      userId,
      venueId: data.venueId,
      checkId: data.checkId,
      dateISO: iso,
      ...values,
    })
  }

  revalidatePath(FOOD_PATH)
  return { passed }
}

/** Seeds a standard set of HACCP checks for venues starting from scratch. */
export async function seedStarterChecks(venueId: number) {
  const userId = await getUserId()

  const existing = await db
    .select({ id: foodCheck.id })
    .from(foodCheck)
    .where(and(eq(foodCheck.userId, userId), eq(foodCheck.venueId, venueId)))
  if (existing.length > 0) return

  const starters: Array<typeof foodCheck.$inferInsert> = [
    { userId, venueId, name: "Fridge temperature", area: "Fridge", type: "Temperature", minTemp: 0, maxTemp: 50, frequency: "Daily", timeOfDay: "Opening", sortOrder: 1 },
    { userId, venueId, name: "Freezer temperature", area: "Freezer", type: "Temperature", minTemp: -250, maxTemp: -180, frequency: "Daily", timeOfDay: "Opening", sortOrder: 2 },
    { userId, venueId, name: "Hot hold temperature", area: "Hot Hold", type: "Temperature", minTemp: 630, maxTemp: 900, frequency: "Daily", timeOfDay: "Service", sortOrder: 3 },
    { userId, venueId, name: "Cooking core temperature", area: "Cooking", type: "Temperature", minTemp: 750, maxTemp: 1000, frequency: "Daily", timeOfDay: "Service", sortOrder: 4 },
    { userId, venueId, name: "Delivery temperature check", area: "Delivery", type: "Visual", frequency: "Daily", timeOfDay: "Opening", sortOrder: 5 },
    { userId, venueId, name: "Cleaning schedule complete", area: "Cleaning", type: "Visual", frequency: "Daily", timeOfDay: "Close", sortOrder: 6 },
    { userId, venueId, name: "Allergen matrix up to date", area: "Allergen", type: "Visual", frequency: "Weekly", sortOrder: 7 },
    { userId, venueId, name: "Pest control visual check", area: "Pest", type: "Visual", frequency: "Daily", timeOfDay: "Opening", sortOrder: 8 },
  ]

  await db.insert(foodCheck).values(starters)
  revalidatePath(FOOD_PATH)
}

/* -------------------------------- Policies -------------------------------- */

export async function getFoodPolicies(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(foodPolicy)
    .where(and(eq(foodPolicy.userId, userId), eq(foodPolicy.venueId, venueId)))
    .orderBy(desc(foodPolicy.id))
}

export async function createFoodPolicy(data: {
  venueId: number
  title: string
  category: string
  version: string
  reviewDate?: string
  fileUrl?: string
  content?: string
}) {
  const userId = await getUserId()
  const title = data.title.trim()
  if (!title) throw new Error("Policy title is required")

  const [created] = await db
    .insert(foodPolicy)
    .values({
      userId,
      venueId: data.venueId,
      title,
      category: data.category || "HACCP",
      version: data.version || "1.0",
      reviewDate: data.reviewDate?.trim() || null,
      fileUrl: data.fileUrl?.trim() || null,
      content: data.content?.trim() || null,
      status: "Published",
    })
    .returning()

  revalidatePath(FOOD_PATH)
  return created
}

export async function deleteFoodPolicy(id: number) {
  const userId = await getUserId()
  await db.delete(foodPolicy).where(and(eq(foodPolicy.id, id), eq(foodPolicy.userId, userId)))
  revalidatePath(FOOD_PATH)
}

/* ---------------------------- Score & alerts ------------------------------ */

export type FoodScore = {
  score: number
  label: string
  dueToday: number
  completedToday: number
  passedToday: number
  failedToday: number
  areas: Array<{ area: string; total: number; done: number; failed: number }>
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent"
  if (score >= 75) return "Good"
  if (score >= 50) return "Needs work"
  return "At risk"
}

export async function getFoodScore(venueId: number): Promise<FoodScore> {
  const checks = await getFoodChecks(venueId)
  const due = checks.filter((c) => c.active)
  const dueToday = due.length
  const completedToday = due.filter((c) => c.todayLog).length
  const passedToday = due.filter((c) => c.todayLog?.passed).length
  const failedToday = due.filter((c) => c.todayLog && !c.todayLog.passed).length

  const score = dueToday === 0 ? 0 : Math.round((passedToday / dueToday) * 100)

  const areaMap = new Map<string, { area: string; total: number; done: number; failed: number }>()
  for (const c of due) {
    const entry = areaMap.get(c.area) ?? { area: c.area, total: 0, done: 0, failed: 0 }
    entry.total += 1
    if (c.todayLog) entry.done += 1
    if (c.todayLog && !c.todayLog.passed) entry.failed += 1
    areaMap.set(c.area, entry)
  }

  return {
    score,
    label: scoreLabel(score),
    dueToday,
    completedToday,
    passedToday,
    failedToday,
    areas: Array.from(areaMap.values()),
  }
}

export type FoodAlert = {
  id: string
  severity: "high" | "medium" | "low"
  title: string
  detail: string
}

export async function getFoodAlerts(venueId: number): Promise<FoodAlert[]> {
  const checks = await getFoodChecks(venueId)
  const alerts: FoodAlert[] = []

  for (const c of checks) {
    if (!c.active) continue
    if (c.todayLog && !c.todayLog.passed) {
      const reading = c.todayLog.tempReading != null ? `${tenthsToTemp(c.todayLog.tempReading)}°C` : "Failed"
      alerts.push({
        id: `fail-${c.id}`,
        severity: "high",
        title: `${c.name} failed`,
        detail: `${c.area} · ${reading}${c.todayLog.correctiveAction ? ` · ${c.todayLog.correctiveAction}` : " · needs corrective action"}`,
      })
    } else if (!c.todayLog) {
      alerts.push({
        id: `due-${c.id}`,
        severity: "medium",
        title: `${c.name} not logged`,
        detail: `${c.area} · due ${c.timeOfDay ?? c.frequency.toLowerCase()}`,
      })
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 }
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
}
