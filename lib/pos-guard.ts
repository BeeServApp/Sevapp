import "server-only"

import { redirect } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { venue as venueTable } from "@/lib/db/schema"
import { getActiveVenueId, getCurrentUser, getSession } from "@/lib/session"
import { getInstalledModuleIds } from "@/app/actions/modules"

export interface PosContext {
  me: Awaited<ReturnType<typeof getCurrentUser>>
  venueId: number | null
  venueName: string | null
  venues: { id: number; name: string }[]
  canManage: boolean
}

/**
 * Guard + shared data loader for every /pos page. Requires a signed-in user
 * whose account has installed the EPOS add-on; otherwise redirects to sign-in
 * or the Marketplace. Resolves the active venue and the venues the user can see.
 */
export async function getPosContext(): Promise<PosContext> {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()

  const installed = await getInstalledModuleIds()
  if (!installed.includes("epos")) redirect("/marketplace")

  const venues = await db
    .select({ id: venueTable.id, name: venueTable.name })
    .from(venueTable)
    .where(eq(venueTable.userId, me.accountId))
    .orderBy(asc(venueTable.id))

  const venueId = await getActiveVenueId(me.accountId)
  const venueName = venues.find((v) => v.id === venueId)?.name ?? null

  return { me, venueId, venueName, venues, canManage: me.appRole === "owner" }
}
