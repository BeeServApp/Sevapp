"use server"

import { db } from "@/lib/db"
import { certificate, complianceCheck, document } from "@/lib/db/schema"
import { getUserId } from "@/lib/session"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const COMPLIANCE_PATH = "/compliance"

function today() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

/* ----------------------------- Compliance checks -------------------------- */

export async function getChecks(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(complianceCheck)
    .where(and(eq(complianceCheck.userId, userId), eq(complianceCheck.venueId, venueId)))
    .orderBy(asc(complianceCheck.id))
}

export async function createCheck(data: {
  venueId: number
  name: string
  frequency: string
  owner?: string
  status: string
}) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Check name is required")

  const [created] = await db
    .insert(complianceCheck)
    .values({
      userId,
      venueId: data.venueId,
      name,
      frequency: data.frequency || "Monthly",
      owner: data.owner?.trim() || null,
      lastDone: data.status === "Complete" ? today() : "—",
      status: data.status || "Due",
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

/** Marks a check complete and stamps today's date as the last-done date. */
export async function logCheck(id: number) {
  const userId = await getUserId()
  await db
    .update(complianceCheck)
    .set({ status: "Complete", lastDone: today() })
    .where(and(eq(complianceCheck.id, id), eq(complianceCheck.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function updateCheckStatus(id: number, status: string) {
  const userId = await getUserId()
  await db
    .update(complianceCheck)
    .set({ status, ...(status === "Complete" ? { lastDone: today() } : {}) })
    .where(and(eq(complianceCheck.id, id), eq(complianceCheck.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function deleteCheck(id: number) {
  const userId = await getUserId()
  await db
    .delete(complianceCheck)
    .where(and(eq(complianceCheck.id, id), eq(complianceCheck.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* ------------------------------- Certificates ----------------------------- */

export async function getCertificates(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(certificate)
    .where(and(eq(certificate.userId, userId), eq(certificate.venueId, venueId)))
    .orderBy(asc(certificate.id))
}

export async function createCertificate(data: {
  venueId: number
  name: string
  authority?: string
  expires?: string
  status: string
}) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Certificate name is required")

  const [created] = await db
    .insert(certificate)
    .values({
      userId,
      venueId: data.venueId,
      name,
      authority: data.authority?.trim() || null,
      expires: data.expires?.trim() || "—",
      status: data.status || "Valid",
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

export async function updateCertificate(
  id: number,
  data: { name: string; authority?: string; expires?: string; status: string },
) {
  const userId = await getUserId()
  await db
    .update(certificate)
    .set({
      name: data.name.trim(),
      authority: data.authority?.trim() || null,
      expires: data.expires?.trim() || "—",
      status: data.status,
    })
    .where(and(eq(certificate.id, id), eq(certificate.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

export async function deleteCertificate(id: number) {
  const userId = await getUserId()
  await db
    .delete(certificate)
    .where(and(eq(certificate.id, id), eq(certificate.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}

/* -------------------------------- Documents ------------------------------- */

export async function getDocuments(venueId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(document)
    .where(and(eq(document.userId, userId), eq(document.venueId, venueId)))
    .orderBy(desc(document.id))
}

export async function createDocument(data: {
  venueId: number
  name: string
  category?: string
  owner?: string
}) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) throw new Error("Document name is required")

  const [created] = await db
    .insert(document)
    .values({
      userId,
      venueId: data.venueId,
      name,
      category: data.category?.trim() || "General",
      owner: data.owner?.trim() || null,
      updated: today() + " " + new Date().getFullYear(),
    })
    .returning()

  revalidatePath(COMPLIANCE_PATH)
  return created
}

export async function deleteDocument(id: number) {
  const userId = await getUserId()
  await db.delete(document).where(and(eq(document.id, id), eq(document.userId, userId)))
  revalidatePath(COMPLIANCE_PATH)
}
