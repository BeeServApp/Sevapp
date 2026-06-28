"use server"

import { db } from "@/lib/db"
import { budget, type DbBudget } from "@/lib/db/schema"
import { getAccountId as getUserId } from "@/lib/session"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

/** All budgets for the current account, keyed by venueId for quick lookup. */
export async function getBudgets(): Promise<Record<number, DbBudget>> {
  const userId = await getUserId()
  const rows = await db.select().from(budget).where(eq(budget.userId, userId))
  const map: Record<number, DbBudget> = {}
  for (const row of rows) map[row.venueId] = row
  return map
}

/** The budget for a single venue (or null if none set). */
export async function getBudget(venueId: number): Promise<DbBudget | null> {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(budget)
    .where(and(eq(budget.userId, userId), eq(budget.venueId, venueId)))
    .limit(1)
  return row ?? null
}

export interface BudgetInput {
  venueId: number
  weeklySalesPence: number | null
  monthlySalesPence: number | null
  labourPctTarget: number | null
  gpPctTarget: number | null
}

/** Create or update the budget targets for a venue (one row per venue). */
export async function saveBudget(input: BudgetInput) {
  const userId = await getUserId()
  const existing = await getBudget(input.venueId)

  if (existing) {
    const [updated] = await db
      .update(budget)
      .set({
        weeklySalesPence: input.weeklySalesPence,
        monthlySalesPence: input.monthlySalesPence,
        labourPctTarget: input.labourPctTarget,
        gpPctTarget: input.gpPctTarget,
        updatedAt: new Date(),
      })
      .where(and(eq(budget.id, existing.id), eq(budget.userId, userId)))
      .returning()
    revalidatePath("/financials")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/group")
    return updated
  }

  const [created] = await db
    .insert(budget)
    .values({
      userId,
      venueId: input.venueId,
      weeklySalesPence: input.weeklySalesPence,
      monthlySalesPence: input.monthlySalesPence,
      labourPctTarget: input.labourPctTarget,
      gpPctTarget: input.gpPctTarget,
    })
    .returning()
  revalidatePath("/financials")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/group")
  return created
}
