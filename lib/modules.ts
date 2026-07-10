// Marketplace add-on modules. Unlike the core sidebar modules in nav-config,
// these are opt-in: an owner installs them from the Marketplace and they then
// appear in the app. Keep ids stable — they're persisted in
// `company.installedModules` (a JSON string array).

export interface MarketplaceModuleDef {
  id: string
  name: string
  /** Route the module opens at. */
  path: string
  /** Whether the module can actually be installed yet (vs. "coming soon"). */
  installable: boolean
}

export const MARKETPLACE_MODULES: MarketplaceModuleDef[] = [
  { id: "epos", name: "Beeserv EPOS", path: "/pos", installable: true },
  { id: "payments", name: "Beeserv Payments", path: "/payments", installable: false },
  { id: "accountancy", name: "Beeserv Accountancy", path: "/accountancy", installable: false },
]

export function getModuleDef(id: string): MarketplaceModuleDef | undefined {
  return MARKETPLACE_MODULES.find((m) => m.id === id)
}

/** Safely parse the JSON string stored in `company.installedModules`. */
export function parseInstalledModules(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}
