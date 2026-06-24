import { Suspense } from "react"
import { syncSquareForVenue } from "@/lib/square-sync"

// Runs the Square -> takings materialization in the background behind a
// Suspense boundary so pages (Financials, etc.) render instantly instead of
// blocking on Square's paginated, network-bound API. Renders nothing.

async function Runner({ accountId, venueId }: { accountId: string; venueId: number }) {
  try {
    await syncSquareForVenue(accountId, venueId)
  } catch {
    // Square downtime must never break (or stall) the page.
  }
  return null
}

export function SquareBackgroundSync({
  accountId,
  venueId,
}: {
  accountId: string
  venueId: number
}) {
  return (
    <Suspense fallback={null}>
      <Runner accountId={accountId} venueId={venueId} />
    </Suspense>
  )
}
