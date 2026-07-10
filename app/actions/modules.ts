"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { company } from "@/lib/db/schema"
import { getAccountId, requireOwner } from "@/lib/session"
import { ensureCompanyRow } from "@/lib/trial"
import { getModuleDef, parseInstalledModules } from "@/lib/modules"

/** Installed Marketplace add-on module ids for the current account. */
export async function getInstalledModuleIds(): Promise<string[]> {
  const accountId = await getAccountId()
  const row = await ensureCompanyRow(accountId)
  return parseInstalledModules(row.installedModules)
}

async function setInstalledModules(accountId: string, ids: string[]) {
  await db
    .update(company)
    .set({ installedModules: JSON.stringify(Array.from(new Set(ids))), updatedAt: new Date() })
    .where(eq(company.userId, accountId))
  revalidatePath("/", "layout")
  revalidatePath("/marketplace")
}

/** Install a Marketplace module (owner only). Free toggle — no billing. */
export async function installModule(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireOwner()
  const def = getModuleDef(id)
  if (!def) return { ok: false, error: "Unknown module" }
  if (!def.installable) return { ok: false, error: "This module isn't available to install yet" }

  const accountId = await getAccountId()
  const row = await ensureCompanyRow(accountId)
  const current = parseInstalledModules(row.installedModules)
  if (!current.includes(id)) await setInstalledModules(accountId, [...current, id])
  return { ok: true }
}

/** Uninstall a Marketplace module (owner only). Catalog/sales data is kept. */
export async function uninstallModule(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireOwner()
  const accountId = await getAccountId()
  const row = await ensureCompanyRow(accountId)
  const current = parseInstalledModules(row.installedModules)
  await setInstalledModules(
    accountId,
    current.filter((m) => m !== id),
  )
  return { ok: true }
}
