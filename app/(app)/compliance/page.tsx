import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ComplianceView } from "@/components/compliance-view"
import { getActiveVenueId, getSession } from "@/lib/session"
import { getCertificates, getChecks, getDocuments } from "@/app/actions/compliance"

export const metadata: Metadata = {
  title: "Compliance — Tapsheet",
}

export default async function CompliancePage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start tracking compliance.
      </p>
    )
  }

  const [checks, certificates, documents] = await Promise.all([
    getChecks(venueId),
    getCertificates(venueId),
    getDocuments(venueId),
  ])

  return (
    <ComplianceView
      venueId={venueId}
      checks={checks}
      certificates={certificates}
      documents={documents}
    />
  )
}
