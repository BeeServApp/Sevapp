import { Suspense } from "react"
import { CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSquareSales, type SquareSales } from "@/app/actions/square"
import { syncSquareForVenue } from "@/lib/square-sync"
import { SquareSalesCard } from "@/components/square-sales-card"

// Streams the Square sales card into the dashboard so navigation is never
// blocked by Square's (paginated, network-bound) API. The sync + fetch run
// inside an async server component behind a Suspense boundary, letting the
// rest of the dashboard render instantly.

async function SquareSalesContent({
  accountId,
  venueId,
}: {
  accountId: string
  venueId: number
}) {
  // Materialize the latest Square card sales into takings. Fail soft so Square
  // downtime never breaks (or stalls) the dashboard.
  try {
    await syncSquareForVenue(accountId, venueId)
  } catch {
    // ignore
  }

  let sales: SquareSales = { state: "not_connected" }
  try {
    sales = await getSquareSales(venueId)
  } catch {
    sales = { state: "error", message: "Square request failed" }
  }

  return <SquareSalesCard sales={sales} />
}

function SquareSalesSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </div>
          <div>
            <CardTitle>Square sales</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">Loading live takings from Square…</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-5 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
      </CardContent>
    </Card>
  )
}

export function SquareSalesSection({
  accountId,
  venueId,
}: {
  accountId: string
  venueId: number
}) {
  return (
    <Suspense fallback={<SquareSalesSkeleton />}>
      <SquareSalesContent accountId={accountId} venueId={venueId} />
    </Suspense>
  )
}
