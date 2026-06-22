"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FoodOverview } from "@/components/food/food-overview"
import { HaccpChecks } from "@/components/food/haccp-checks"
import { FoodPolicies } from "@/components/food/food-policies"
import type { FoodScore, FoodAlert, FoodCheckWithLog } from "@/app/actions/food"
import type { DbFoodPolicy } from "@/lib/db/schema"

export function FoodHub({
  venueId,
  score,
  alerts,
  checks,
  policies,
}: {
  venueId: number
  score: FoodScore
  alerts: FoodAlert[]
  checks: FoodCheckWithLog[]
  policies: DbFoodPolicy[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") ?? "overview"

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", tab)
      router.replace(`/food?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Food safety management"
        description="HACCP temperature logs, hygiene checks and food safety documents — keep every venue inspection-ready."
      />

      <Tabs value={activeTab} onValueChange={(v) => setTab(v ?? "overview")}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checks">HACCP checks</TabsTrigger>
          <TabsTrigger value="policies">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <FoodOverview score={score} alerts={alerts} onJumpToTab={setTab} />
        </TabsContent>

        <TabsContent value="checks" className="mt-4">
          <HaccpChecks venueId={venueId} checks={checks} />
        </TabsContent>

        <TabsContent value="policies" className="mt-4">
          <FoodPolicies venueId={venueId} policies={policies} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
