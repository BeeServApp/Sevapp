"use server"

import { db } from "@/lib/db"
import { member } from "@/lib/db/schema"
import { getAccountId as getUserId } from "@/lib/session"
import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getMembers(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.venueId, venueId)))
    .orderBy(asc(member.id))
}

export async function addMember(data: {
  venueId: number
  name: string
  email: string
  role: string
}) {
  const userId = await getUserId()
  const name = data.name.trim()
  const email = data.email.trim()
  if (!name) throw new Error("Name is required")
  if (!email) throw new Error("Email is required")

  const [created] = await db
    .insert(member)
    .values({
      userId,
      venueId: data.venueId,
      name,
      email,
      role: data.role || "Staff",
      status: "Invited",
    })
    .returning()

  revalidatePath("/settings")
  return created
}

export async function updateMember(
  id: number,
  data: { name: string; email: string; role: string; status: string },
) {
  const userId = await getUserId()
  await db
    .update(member)
    .set({
      name: data.name.trim(),
      email: data.email.trim(),
      role: data.role,
      status: data.status,
    })
    .where(and(eq(member.id, id), eq(member.userId, userId)))
  revalidatePath("/settings")
}

export async function removeMember(id: number) {
  const userId = await getUserId()
  await db.delete(member).where(and(eq(member.id, id), eq(member.userId, userId)))
  revalidatePath("/settings")
}
