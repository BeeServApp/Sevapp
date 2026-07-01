// Shared definitions for sidebar modules and settings sub-tabs. These power
// both the navigation UI and the "hide tabs you don't use" preferences so the
// two never drift out of sync.

export interface ModuleDef {
  href: string
  label: string
  description: string
}

// Toggleable sidebar modules. The Dashboard is intentionally omitted because it
// is the workspace home and cannot be hidden.
export const MODULES: ModuleDef[] = [
  { href: "/calendar", label: "Calendar", description: "Events, tasks and bookings on one schedule." },
  { href: "/operations", label: "Operations", description: "Orders, suppliers, events and maintenance." },
  { href: "/tasks", label: "Task Management", description: "Checklists, corrective actions and audits." },
  { href: "/assets", label: "Asset Tracking", description: "Equipment register and lifecycle." },
  { href: "/financials", label: "Financials", description: "Takings, expenses and reporting." },
  { href: "/staff", label: "HR", description: "Onboarding, rotas, leave, documents and time tracking." },
  { href: "/compliance", label: "Compliance", description: "Certificates, checks and documents." },
  { href: "/food", label: "Food Safety", description: "HACCP checks, policies and food hygiene." },
]

// Modules a staff (non-owner) account is allowed to see. Staff get a focused
// experience: their schedule and the tasks assigned to them. Everything else is
// hidden from the sidebar and blocked at the route level.
export const STAFF_ALLOWED_PATHS = ["/staff", "/tasks"]

// Settings tabs a staff account may open. Staff manage only their own profile
// and personal preferences — never company, venues, team, billing, etc.
export const STAFF_ALLOWED_SETTINGS_TABS = ["account", "preferences"]

export function isPathAllowedForRole(pathname: string, appRole: "owner" | "staff") {
  if (appRole === "owner") return true
  return STAFF_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export interface SettingsTabDef {
  id: string
  label: string
  // Core tabs cannot be hidden (you always need a way back to preferences).
  lockable: boolean
}

export const SETTINGS_TABS: SettingsTabDef[] = [
  { id: "account", label: "Account", lockable: false },
  { id: "company", label: "Company", lockable: true },
  { id: "venues", label: "Venues", lockable: true },
  { id: "team", label: "Team & users", lockable: true },
  { id: "billing", label: "Billing", lockable: true },
  { id: "integrations", label: "Integrations", lockable: true },
  { id: "preferences", label: "Preferences", lockable: false },
]
