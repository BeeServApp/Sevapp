import "server-only"

import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/session"
import { ensureCompanyRow } from "@/lib/trial"
import { isModuleAllowedForPlan, type PlanId } from "@/lib/pricing"

/**
 * Returns the active plan for a data-scope, creating the trial row on first
 * access. Staff logins inherit their owner's plan.
 */
export async function getActivePlanFor(accountId: string): Promise<PlanId | null> {
  const row = await ensureCompanyRow(accountId)
  return (row.subscriptionPlan as PlanId | null) ?? null
}

/**
 * Server guard for a plan-gated module page. If the account's plan does not
 * unlock the given module path, owners are redirected to the billing page with
 * an upgrade prompt, and staff are sent back to their schedule. Call this AFTER
 * the page's role guard on premium pages.
 */
export async function guardModuleAccess(modulePath: string): Promise<void> {
  const me = await getCurrentUser()
  const plan = await getActivePlanFor(me.accountId)
  if (isModuleAllowedForPlan(plan, modulePath)) return

  if (me.appRole === "owner") {
    redirect(`/settings?tab=billing&upgrade=${encodeURIComponent(modulePath)}`)
  }
  redirect("/staff")
}
