import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { venue as venueTable } from "@/lib/db/schema"
import { getActiveVenueId, getCurrentUser, getSession } from "@/lib/session"
import { getInstalledModuleIds } from "@/app/actions/modules"
import { getPosMenu, getPosTerminals, getPosTodaySummary } from "@/app/actions/pos"
import { PosApp } from "@/components/pos/pos-app"
import { PosEmptyState } from "@/components/pos/pos-empty-state"

export default async function PosPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()
  const installed = await getInstalledModuleIds()
  if (!installed.includes("epos")) redirect("/marketplace")

  const venueId = await getActiveVenueId(me.accountId)
  if (venueId == null) {
    return <PosEmptyState reason="no-venue" />
  }

  const [venue] = await db
    .select({ id: venueTable.id, name: venueTable.name })
    .from(venueTable)
    .where(and(eq(venueTable.id, venueId), eq(venueTable.userId, me.accountId)))
    .limit(1)

  if (!venue) return <PosEmptyState reason="no-venue" />

  const [menu, terminals, summary] = await Promise.all([
    getPosMenu(venueId),
    getPosTerminals(venueId),
    getPosTodaySummary(venueId),
  ])

  return (
    <PosApp
      venueId={venueId}
      venueName={venue.name}
      userName={me.name}
      canManage={me.appRole === "owner"}
      categories={menu.categories}
      products={menu.products}
      terminals={terminals}
      todayTotalPence={summary.totalPence}
      todayCount={summary.count}
    />
  )
}
