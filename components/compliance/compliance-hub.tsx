"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ComplianceOverview } from "@/components/compliance/compliance-overview"
import { SafetyRegister } from "@/components/compliance/safety-register"
import { DailyChecklists } from "@/components/compliance/daily-checklists"
import { RiskAssessments } from "@/components/compliance/risk-assessments"
import { StaffPolicies } from "@/components/compliance/staff-policies"
import { AuditsActions } from "@/components/compliance/audits-actions"
import { ComplianceView } from "@/components/compliance-view"
import type {
  ComplianceScore,
  Notification,
  ChecklistWithRun,
  PolicyWithAcks,
  RiskAssessmentWithHazards,
} from "@/app/actions/safety"
import type {
  DbSafetyRecord,
  DbAudit,
  DbCorrectiveAction,
  DbCertificate,
  DbComplianceCheck,
  DbDocument,
} from "@/lib/db/schema"

export function ComplianceHub({
  venueId,
  score,
  notifications,
  fireRecords,
  hsRecords,
  licensingRecords,
  propertyRecords,
  checklists,
  assessments,
  policies,
  audits,
  actions,
  checks,
  certificates,
  documents,
}: {
  venueId: number
  score: ComplianceScore
  notifications: Notification[]
  fireRecords: DbSafetyRecord[]
  hsRecords: DbSafetyRecord[]
  licensingRecords: DbSafetyRecord[]
  propertyRecords: DbSafetyRecord[]
  checklists: ChecklistWithRun[]
  assessments: RiskAssessmentWithHazards[]
  policies: PolicyWithAcks[]
  audits: DbAudit[]
  actions: DbCorrectiveAction[]
  checks: DbComplianceCheck[]
  certificates: DbCertificate[]
  documents: DbDocument[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") ?? "overview"

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", tab)
      router.replace(`/compliance?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const counts = {
    overdueRecords: notifications.filter((n) => n.kind === "overdue").length,
    expiringCerts: notifications.filter((n) => n.kind === "expiring").length,
    openActions: actions.filter((a) => a.status !== "Resolved").length,
    checklistsDueToday: notifications.filter((n) => n.kind === "checklist").length,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Safety management"
        description="Fire safety, licensing, property compliance, risk assessments and daily checks — always audit-ready."
      />

      <Tabs value={activeTab} onValueChange={(v) => setTab(v ?? "overview")}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklists">Daily checklists</TabsTrigger>
          <TabsTrigger value="fire">Fire safety</TabsTrigger>
          <TabsTrigger value="hs">H&amp;S</TabsTrigger>
          <TabsTrigger value="licensing">Licensing</TabsTrigger>
          <TabsTrigger value="property">Property</TabsTrigger>
          <TabsTrigger value="risk">Risk assessments</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="audits">Audits &amp; actions</TabsTrigger>
          <TabsTrigger value="records">Certificates &amp; docs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <ComplianceOverview
            score={score}
            notifications={notifications}
            counts={counts}
            onJumpToTab={setTab}
          />
        </TabsContent>

        <TabsContent value="checklists" className="mt-4">
          <DailyChecklists venueId={venueId} checklists={checklists} />
        </TabsContent>

        <TabsContent value="fire" className="mt-4">
          <SafetyRegister
            venueId={venueId}
            module="Fire Safety"
            description="Fire risk assessments, alarm and extinguisher tests, emergency lighting and evacuation drills."
            records={fireRecords}
          />
        </TabsContent>

        <TabsContent value="hs" className="mt-4">
          <SafetyRegister
            venueId={venueId}
            module="Health & Safety"
            description="General H&S duties — first aid, COSHH, manual handling, equipment checks and accident reporting."
            records={hsRecords}
          />
        </TabsContent>

        <TabsContent value="licensing" className="mt-4">
          <SafetyRegister
            venueId={venueId}
            module="Licensing"
            description="Premises and personal licences, conditions, and licensing objectives compliance."
            records={licensingRecords}
          />
        </TabsContent>

        <TabsContent value="property" className="mt-4">
          <SafetyRegister
            venueId={venueId}
            module="Property"
            description="Gas safety, electrical (EICR), legionella, PAT testing and building maintenance obligations."
            records={propertyRecords}
          />
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <RiskAssessments venueId={venueId} assessments={assessments} />
        </TabsContent>

        <TabsContent value="policies" className="mt-4">
          <StaffPolicies venueId={venueId} policies={policies} />
        </TabsContent>

        <TabsContent value="audits" className="mt-4">
          <AuditsActions venueId={venueId} audits={audits} actions={actions} />
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <ComplianceView
            venueId={venueId}
            checks={checks}
            certificates={certificates}
            documents={documents}
            embedded
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
