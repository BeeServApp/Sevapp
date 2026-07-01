"use server"

import { db } from "@/lib/db"
import { staffMember, user, venue, venueAccess } from "@/lib/db/schema"
import { requireOwner } from "@/lib/session"
import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type ManagerRoleValue = "none" | "manager" | "area_manager"

export interface ManagedLogin {
  /** The staff login's user id. */
  userId: string
  name: string
  email: string
  /** The staff member's "home" venue (from their rota record). */
  homeVenueId: number | null
  managerRole: ManagerRoleValue
  /** Venue ids an area manager can access. */
  venueIds: number[]
}

export interface ManagerAccessData {
  venues: { id: number; name: string }[]
  logins: ManagedLogin[]
}

/**
 * Owner view of every staff login in the account, with their manager role and
 * (for area managers) the venues they can access.
 */
export async function getManagerAccess(): Promise<ManagerAccessData> {
  const me = await requireOwner()
  const accountId = me.accountId

  const venues = await db
    .select({ id: venue.id, name: venue.name })
    .from(venue)
    .where(eq(venue.userId, accountId))
    .orderBy(asc(venue.name))

  // Staff logins are users whose ownerId is this account.
  const logins = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      managerRole: user.managerRole,
      staffMemberId: user.staffMemberId,
    })
    .from(user)
    .where(and(eq(user.ownerId, accountId), eq(user.appRole, "staff")))
    .orderBy(asc(user.name))

  // Resolve each login's home venue and assigned venues.
  const access = await db
    .select()
    .from(venueAccess)
    .where(eq(venueAccess.userId, accountId))

  const result: ManagedLogin[] = []
  for (const l of logins) {
    let homeVenueId: number | null = null
    if (l.staffMemberId != null) {
      const [sm] = await db
        .select({ venueId: staffMember.venueId })
        .from(staffMember)
        .where(eq(staffMember.id, l.staffMemberId))
        .limit(1)
      homeVenueId = sm?.venueId ?? null
    }
    const managerRole: ManagerRoleValue =
      l.managerRole === "manager" || l.managerRole === "area_manager" ? l.managerRole : "none"
    result.push({
      userId: l.userId,
      name: l.name,
      email: l.email,
      homeVenueId,
      managerRole,
      venueIds: access.filter((a) => a.memberUserId === l.userId).map((a) => a.venueId),
    })
  }

  return { venues, logins: result }
}

/**
 * Owner action: set a staff login's manager role and, for area managers, the
 * venues they can access. Managers are pinned to their home venue, so no
 * explicit venue list is stored for them.
 */
export async function setMemberRole(input: {
  memberUserId: string
  managerRole: ManagerRoleValue
  venueIds?: number[]
}): Promise<{ ok: true }> {
  const me = await requireOwner()
  const accountId = me.accountId

  // Confirm the target is a staff login belonging to this account.
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, input.memberUserId), eq(user.ownerId, accountId), eq(user.appRole, "staff")))
    .limit(1)
  if (!target) throw new Error("Team member not found")

  const nextRole = input.managerRole === "manager" || input.managerRole === "area_manager"
    ? input.managerRole
    : null

  await db
    .update(user)
    .set({ managerRole: nextRole, updatedAt: new Date() })
    .where(eq(user.id, input.memberUserId))

  // Rewrite venue_access rows for this member.
  await db
    .delete(venueAccess)
    .where(and(eq(venueAccess.userId, accountId), eq(venueAccess.memberUserId, input.memberUserId)))

  if (nextRole === "area_manager" && input.venueIds && input.venueIds.length > 0) {
    // Only persist venues that belong to this account.
    const owned = await db
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.userId, accountId))
    const ownedIds = new Set(owned.map((v) => v.id))
    const rows = input.venueIds
      .filter((id) => ownedIds.has(id))
      .map((venueId) => ({ userId: accountId, memberUserId: input.memberUserId, venueId }))
    if (rows.length > 0) await db.insert(venueAccess).values(rows)
  }

  revalidatePath("/settings")
  return { ok: true }
}
