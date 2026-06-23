// Canonical list of customizable dashboard sections. The order here is the
// default layout; owners can reorder and hide sections, persisted per-account.

export interface DashboardSectionMeta {
  id: string
  label: string
  /** Short description shown in the customize panel. */
  hint: string
}

export const DASHBOARD_SECTIONS: DashboardSectionMeta[] = [
  { id: "kpis", label: "Key metrics", hint: "Revenue, gross profit, labour, open tasks" },
  { id: "revenue", label: "Revenue this week", hint: "Daily takings trend" },
  { id: "salesMix", label: "Sales mix", hint: "Revenue split by category" },
  { id: "square", label: "Square sales", hint: "Live Square POS totals" },
  { id: "quickLinks", label: "Quick links", hint: "Shortcuts to each module" },
  { id: "tasks", label: "Open tasks", hint: "Outstanding team tasks" },
  { id: "events", label: "Upcoming events", hint: "Scheduled events & covers" },
  { id: "gaming", label: "Gaming machines", hint: "Machine Games Duty & revenue" },
]

export const DEFAULT_SECTION_ORDER = DASHBOARD_SECTIONS.map((s) => s.id)

export interface DashboardLayout {
  /** Ordered list of section ids. Unknown/new ids are appended at render time. */
  order: string[]
  /** Section ids the owner has hidden. */
  hidden: string[]
}

export const EMPTY_LAYOUT: DashboardLayout = { order: [], hidden: [] }

/**
 * Resolves a stored layout against the canonical section list so that newly
 * added sections always appear (appended) and removed sections are dropped.
 */
export function resolveLayout(
  layout: DashboardLayout,
  availableIds: string[],
): { orderedIds: string[]; hidden: Set<string> } {
  const available = new Set(availableIds)
  const seen = new Set<string>()
  const orderedIds: string[] = []

  // Keep the saved order for ids that still exist.
  for (const id of layout.order) {
    if (available.has(id) && !seen.has(id)) {
      orderedIds.push(id)
      seen.add(id)
    }
  }
  // Append any available sections not present in the saved order.
  for (const id of availableIds) {
    if (!seen.has(id)) {
      orderedIds.push(id)
      seen.add(id)
    }
  }

  return { orderedIds, hidden: new Set(layout.hidden) }
}
