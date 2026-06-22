import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ComplianceHub } from "@/components/compliance/compliance-hub"
import { getActiveVenueId, getSession, guardOwnerPage } from "@/lib/session"
import { getCertificates, getChecks, getDocuments } from "@/app/actions/compliance"
import {
  getAudits,
  getChecklists,
  getComplianceScore,
  getCorrectiveActions,
  getNotifications,
  getPolicies,
  getRiskAssessments,
  getSafetyRecords,
} from "@/app/actions/safety"

export const metadata: Metadata = {
  title: "Safety Management — Tapsheet",
}

export default async function CompliancePage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  await guardOwnerPage()

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start tracking compliance.
      </p>
    )
  }

  const [
    score,
    notifications,
    safetyRecords,
    checklists,
    assessments,
    policies,
    audits,
    actions,
    checks,
    certificates,
    documents,
  ] = await Promise.all([
    getComplianceScore(venueId),
    getNotifications(venueId),
    getSafetyRecords(venueId),
    getChecklists(venueId),
    getRiskAssessments(venueId),
    getPolicies(venueId),
    getAudits(venueId),
    getCorrectiveActions(venueId),
    getChecks(venueId),
    getCertificates(venueId),
    getDocuments(venueId),
  ])

  return (
    <ComplianceHub
      venueId={venueId}
      score={score}
      notifications={notifications}
      fireRecords={safetyRecords.filter((r) => r.module === "Fire Safety")}
      hsRecords={safetyRecords.filter((r) => r.module === "Health & Safety")}
      licensingRecords={safetyRecords.filter((r) => r.module === "Licensing")}
      propertyRecords={safetyRecords.filter((r) => r.module === "Property")}
      checklists={checklists}
      assessments={assessments}
      policies={policies}
      audits={audits}
      actions={actions}
      checks={checks}
      certificates={certificates}
      documents={documents}
    />
  )
}
