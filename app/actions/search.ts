"use server"

import { db } from "@/lib/db"
import {
  asset,
  maintenance,
  order,
  staffMember,
  supplier,
  task,
  venueEvent,
} from "@/lib/db/schema"
import { getAccountId } from "@/lib/session"
import { and, eq, ilike, or } from "drizzle-orm"

export type SearchGroup = "Orders" | "Suppliers" | "Staff" | "Tasks" | "Assets" | "Events" | "Maintenance"

export interface SearchResult {
  id: string
  group: SearchGroup
  title: string
  subtitle: string
  href: string
}

// How many matches to surface per data type.
const PER_GROUP = 4

/**
 * Global search across the active venue's data (orders, suppliers, staff,
 * tasks, assets, events and maintenance jobs). Always scoped by the account's
 * `userId` and the given `venueId`, matching the app's per-query scoping model.
 */
export async function globalSearch(venueId: number, rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim()
  if (q.length < 2) return []

  const userId = await getAccountId()
  const like = `%${q}%`

  // Run every lookup in parallel; each is scoped to the account + venue.
  const [orders, suppliers, staff, tasks, assets, events, jobs] = await Promise.all([
    db
      .select()
      .from(order)
      .where(
        and(
          eq(order.userId, userId),
          eq(order.venueId, venueId),
          or(ilike(order.reference, like), ilike(order.supplier, like), ilike(order.status, like)),
        ),
      )
      .limit(PER_GROUP),
    db
      .select()
      .from(supplier)
      .where(
        and(
          eq(supplier.userId, userId),
          eq(supplier.venueId, venueId),
          or(ilike(supplier.name, like), ilike(supplier.category, like)),
        ),
      )
      .limit(PER_GROUP),
    db
      .select()
      .from(staffMember)
      .where(
        and(
          eq(staffMember.userId, userId),
          eq(staffMember.venueId, venueId),
          or(ilike(staffMember.name, like), ilike(staffMember.role, like), ilike(staffMember.email, like)),
        ),
      )
      .limit(PER_GROUP),
    db
      .select()
      .from(task)
      .where(
        and(
          eq(task.userId, userId),
          eq(task.venueId, venueId),
          or(ilike(task.title, like), ilike(task.area, like), ilike(task.assignee, like)),
        ),
      )
      .limit(PER_GROUP),
    db
      .select()
      .from(asset)
      .where(
        and(
          eq(asset.userId, userId),
          eq(asset.venueId, venueId),
          or(
            ilike(asset.name, like),
            ilike(asset.assetNumber, like),
            ilike(asset.category, like),
            ilike(asset.location, like),
          ),
        ),
      )
      .limit(PER_GROUP),
    db
      .select()
      .from(venueEvent)
      .where(
        and(
          eq(venueEvent.userId, userId),
          eq(venueEvent.venueId, venueId),
          or(ilike(venueEvent.name, like), ilike(venueEvent.owner, like), ilike(venueEvent.status, like)),
        ),
      )
      .limit(PER_GROUP),
    db
      .select()
      .from(maintenance)
      .where(
        and(
          eq(maintenance.userId, userId),
          eq(maintenance.venueId, venueId),
          or(
            ilike(maintenance.assetName, like),
            ilike(maintenance.issue, like),
            ilike(maintenance.assignee, like),
          ),
        ),
      )
      .limit(PER_GROUP),
  ])

  const results: SearchResult[] = []

  for (const o of orders) {
    results.push({
      id: `order-${o.id}`,
      group: "Orders",
      title: o.reference,
      subtitle: `${o.supplier} · ${o.status}`,
      href: "/operations?tab=orders",
    })
  }
  for (const s of suppliers) {
    results.push({
      id: `supplier-${s.id}`,
      group: "Suppliers",
      title: s.name,
      subtitle: s.category ?? "Supplier",
      href: "/operations?tab=suppliers",
    })
  }
  for (const s of staff) {
    results.push({
      id: `staff-${s.id}`,
      group: "Staff",
      title: s.name,
      subtitle: s.role,
      href: "/staff",
    })
  }
  for (const t of tasks) {
    results.push({
      id: `task-${t.id}`,
      group: "Tasks",
      title: t.title,
      subtitle: [t.area, t.assignee].filter(Boolean).join(" · ") || "Task",
      href: "/tasks",
    })
  }
  for (const a of assets) {
    results.push({
      id: `asset-${a.id}`,
      group: "Assets",
      title: a.name,
      subtitle: `${a.assetNumber} · ${a.category}`,
      href: "/assets",
    })
  }
  for (const e of events) {
    results.push({
      id: `event-${e.id}`,
      group: "Events",
      title: e.name,
      subtitle: [e.date, e.status].filter(Boolean).join(" · ") || "Event",
      href: "/operations?tab=events",
    })
  }
  for (const m of jobs) {
    results.push({
      id: `maintenance-${m.id}`,
      group: "Maintenance",
      title: m.assetName,
      subtitle: [m.issue, m.status].filter(Boolean).join(" · ") || "Maintenance",
      href: "/operations?tab=maintenance",
    })
  }

  return results
}
