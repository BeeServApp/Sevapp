"use server"

import { db } from "@/lib/db"
import { expense } from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getExpenses(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(expense)
    .where(and(eq(expense.userId, userId), eq(expense.venueId, venueId)))
    .orderBy(desc(expense.createdAt))
}

export async function createExpense(data: {
  venueId: number
  category: string
  vendor: string
  amountPence: number
  date: string
  status: string
}) {
  const userId = await getUserId()
  const [created] = await db.insert(expense).values({ userId, ...data }).returning()
  revalidatePath("/financials")
  return created
}

export async function updateExpenseStatus(id: number, status: string) {
  const userId = await getUserId()
  const [updated] = await db
    .update(expense)
    .set({ status })
    .where(and(eq(expense.id, id), eq(expense.userId, userId)))
    .returning()
  revalidatePath("/financials")
  return updated
}

export async function deleteExpense(id: number) {
  const userId = await getUserId()
  await db.delete(expense).where(and(eq(expense.id, id), eq(expense.userId, userId)))
  revalidatePath("/financials")
}
