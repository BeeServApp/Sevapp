"use server"

import { getAccountId } from "@/lib/session"
import { ensureCompanyRow } from "@/lib/trial"
import { isPlanId } from "@/lib/pricing"

/**
 * Starts a card-less trial for the signed-in owner on the chosen plan. Called
 * immediately after sign-up so the account's trial is pinned to the plan the
 * user selected on the pricing page (and therefore restricted to its access).
 * Idempotent: if a company row already exists it is left untouched.
 */
export async function startTrialForPlan(plan?: string): Promise<void> {
  const accountId = await getAccountId()
  await ensureCompanyRow(accountId, isPlanId(plan) ? plan : undefined)
}
