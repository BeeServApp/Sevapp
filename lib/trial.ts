import "server-only"

import { db } from "@/lib/db"
import { company } from "@/lib/db/schema"
import { TRIAL_PERIOD_DAYS, type PlanId } from "@/lib/pricing"
import { eq } from "drizzle-orm"

/** Every new business starts on a card-less 14-day Starter trial. */
export const DEFAULT_TRIAL_PLAN: PlanId = "starter"

type CompanyRow = typeof company.$inferSelect

/**
 * Returns the company row for a data-scope, creating it on first access with a
 * 14-day Starter trial already running. This is the single place a company row
 * is ever created so the "no account without a trial plan" rule always holds.
 */
export async function ensureCompanyRow(userId: string): Promise<CompanyRow> {
  const [existing] = await db.select().from(company).where(eq(company.userId, userId)).limit(1)
  if (existing) return existing

  const trialEndsAt = new Date(Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  const [created] = await db
    .insert(company)
    .values({
      userId,
      subscriptionPlan: DEFAULT_TRIAL_PLAN,
      subscriptionStatus: "trialing",
      trialEndsAt,
    })
    .returning()
  return created
}

export interface AccessState {
  /** True when the app should be locked behind the upgrade screen. */
  locked: boolean
  status: string
  plan: PlanId | null
  trialEndsAt: string | null
  /** Whole days left in the trial (0 when expired or not trialing). */
  trialDaysLeft: number
  isTrialing: boolean
}

/**
 * Computes whether an owner still has access. Access is granted while a paid
 * subscription is live (`active`/`past_due`) or while the trial window is still
 * open. Once a trial lapses with no paid subscription, the app locks.
 */
export function computeAccess(row: CompanyRow): AccessState {
  const status = row.subscriptionStatus ?? "none"
  const plan = (row.subscriptionPlan as PlanId | null) ?? null
  const now = Date.now()
  const trialEnd = row.trialEndsAt ? row.trialEndsAt.getTime() : null

  const paidOk = status === "active" || status === "past_due"
  const isTrialing = status === "trialing" && trialEnd != null && trialEnd > now
  const trialDaysLeft =
    trialEnd != null && trialEnd > now ? Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000)) : 0

  return {
    locked: !paidOk && !isTrialing,
    status,
    plan,
    trialEndsAt: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
    trialDaysLeft,
    isTrialing,
  }
}

/** Convenience: fetch the scope's company row (creating a trial) and its access state. */
export async function getAccessState(userId: string): Promise<AccessState> {
  const row = await ensureCompanyRow(userId)
  return computeAccess(row)
}
