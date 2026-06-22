import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"

import { FoodHub } from "@/components/food/food-hub"
import { getActiveVenueId, getSession } from "@/lib/session"
import { getFoodAlerts, getFoodChecks, getFoodPolicies, getFoodScore } from "@/app/actions/food"

export const metadata: Metadata = {
  title: "Food Safety Management — Tapsheet",
  description: "HACCP temperature logs, hygiene checks and food safety documents.",
}

export default async function FoodPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start managing food safety.
      </p>
    )
  }

  const [score, alerts, checks, policies] = await Promise.all([
    getFoodScore(venueId),
    getFoodAlerts(venueId),
    getFoodChecks(venueId),
    getFoodPolicies(venueId),
  ])

  return (
    <Suspense fallback={null}>
      <FoodHub venueId={venueId} score={score} alerts={alerts} checks={checks} policies={policies} />
    </Suspense>
  )
}
