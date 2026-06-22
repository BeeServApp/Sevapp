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
  { href: "/operations", label: "Operations", description: "Orders, suppliers, events and maintenance." },
  { href: "/tasks", label: "Task Management", description: "Checklists, corrective actions and audits." },
  { href: "/assets", label: "Asset Tracking", description: "Equipment register and lifecycle." },
  { href: "/financials", label: "Financials", description: "Takings, expenses and reporting." },
  { href: "/staff", label: "Staff & Scheduling", description: "Rotas, leave and time tracking." },
  { href: "/compliance", label: "Compliance", description: "Certificates, checks and documents." },
]

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
  { id: "preferences", label: "Preferences", lockable: false },
]
