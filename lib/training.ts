// Pure helpers and constants for the training module. Kept out of the
// "use server" actions file because server-action modules may only export
// async functions.

export const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "kitchen", label: "Kitchen staff" },
  { value: "bar", label: "Bar staff" },
  { value: "foh", label: "Front of house" },
  { value: "management", label: "Management" },
] as const

export type AudienceValue = (typeof AUDIENCES)[number]["value"]

export const AUDIENCE_LABEL: Record<string, string> = {
  everyone: "Everyone",
  kitchen: "Kitchen staff",
  bar: "Bar staff",
  foh: "Front of house",
  management: "Management",
  individual: "Individual",
}

/** Buckets a free-text staff role into one of the audience groups. */
export function roleToGroup(role: string | null | undefined): AudienceValue {
  const r = (role ?? "").toLowerCase()
  if (/(chef|kitchen|cook|commis|\bkp\b|pastry|larder)/.test(r)) return "kitchen"
  if (/(bar|cellar|mixolog|barista|sommelier)/.test(r)) return "bar"
  if (/(manager|owner|supervisor|\bgm\b|director|head of)/.test(r)) return "management"
  if (/(front|waiter|waitress|server|host|floor|foh|runner)/.test(r)) return "foh"
  return "foh"
}

/** True when a staff member is targeted by any of a module's assignments. */
export function isAssignedTo(
  assignments: { audience: string; staffMemberId: number | null }[],
  member: { id: number; role: string | null },
): boolean {
  const group = roleToGroup(member.role)
  return assignments.some(
    (a) => a.staffMemberId === member.id || a.audience === "everyone" || a.audience === group,
  )
}
