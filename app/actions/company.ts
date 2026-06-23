"use server"

import { db } from "@/lib/db"
import { company } from "@/lib/db/schema"
import { getAccountId as getUserId } from "@/lib/session"
import { ensureCompanyRow } from "@/lib/trial"
import type { DashboardLayout } from "@/lib/dashboard-sections"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface CompanyData {
  name: string
  tradingName: string
  logo: string | null
  registrationNumber: string
  vatNumber: string
  email: string
  phone: string
  website: string
  address: string
  city: string
  postcode: string
  country: string
  brandColor: string
  currency: string
  timezone: string
  financialYearStart: string
  dateFormat: string
  hiddenModules: string[]
  hiddenSettingsTabs: string[]
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []
  } catch {
    return []
  }
}

/**
 * Returns the company row for the current user, creating an empty one on first
 * access so callers always get a populated object.
 */
export async function getCompany(): Promise<CompanyData> {
  const userId = await getUserId()
  const row = await ensureCompanyRow(userId)

  return {
    name: row.name ?? "",
    tradingName: row.tradingName ?? "",
    logo: row.logo ?? null,
    registrationNumber: row.registrationNumber ?? "",
    vatNumber: row.vatNumber ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    postcode: row.postcode ?? "",
    country: row.country ?? "United Kingdom",
    brandColor: row.brandColor ?? "#16a34a",
    currency: row.currency ?? "GBP",
    timezone: row.timezone ?? "Europe/London",
    financialYearStart: row.financialYearStart ?? "April",
    dateFormat: row.dateFormat ?? "DD/MM/YYYY",
    hiddenModules: parseList(row.hiddenModules),
    hiddenSettingsTabs: parseList(row.hiddenSettingsTabs),
  }
}

async function ensureCompany(userId: string) {
  await ensureCompanyRow(userId)
}

export async function updateCompany(data: {
  name: string
  tradingName?: string
  registrationNumber?: string
  vatNumber?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  postcode?: string
  country?: string
  brandColor?: string
  currency?: string
  timezone?: string
  financialYearStart?: string
  dateFormat?: string
}) {
  const userId = await getUserId()
  await ensureCompany(userId)

  await db
    .update(company)
    .set({
      name: data.name.trim(),
      tradingName: data.tradingName?.trim() || null,
      registrationNumber: data.registrationNumber?.trim() || null,
      vatNumber: data.vatNumber?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      postcode: data.postcode?.trim() || null,
      country: data.country?.trim() || null,
      brandColor: data.brandColor?.trim() || "#16a34a",
      currency: data.currency || "GBP",
      timezone: data.timezone || "Europe/London",
      financialYearStart: data.financialYearStart || "April",
      dateFormat: data.dateFormat || "DD/MM/YYYY",
      updatedAt: new Date(),
    })
    .where(eq(company.userId, userId))

  revalidatePath("/", "layout")
}

export async function getDashboardLayout(): Promise<DashboardLayout> {
  const userId = await getUserId()
  const row = await ensureCompanyRow(userId)
  try {
    const parsed = JSON.parse(row.dashboardLayout || "{}")
    return {
      order: Array.isArray(parsed?.order) ? parsed.order.filter((v: unknown) => typeof v === "string") : [],
      hidden: Array.isArray(parsed?.hidden) ? parsed.hidden.filter((v: unknown) => typeof v === "string") : [],
    }
  } catch {
    return { order: [], hidden: [] }
  }
}

export async function saveDashboardLayout(layout: DashboardLayout) {
  const userId = await getUserId()
  await ensureCompany(userId)

  await db
    .update(company)
    .set({
      dashboardLayout: JSON.stringify({
        order: Array.isArray(layout.order) ? layout.order : [],
        hidden: Array.isArray(layout.hidden) ? layout.hidden : [],
      }),
      updatedAt: new Date(),
    })
    .where(eq(company.userId, userId))

  revalidatePath("/dashboard")
}

export async function updateHiddenTabs(data: {
  hiddenModules: string[]
  hiddenSettingsTabs: string[]
}) {
  const userId = await getUserId()
  await ensureCompany(userId)

  await db
    .update(company)
    .set({
      hiddenModules: JSON.stringify(data.hiddenModules ?? []),
      hiddenSettingsTabs: JSON.stringify(data.hiddenSettingsTabs ?? []),
      updatedAt: new Date(),
    })
    .where(eq(company.userId, userId))

  revalidatePath("/", "layout")
}
