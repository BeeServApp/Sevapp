export type AssetCategory = "Bar" | "Cellar" | "Kitchen" | "Furniture" | "AV & Tech"
export type AssetCondition = "Excellent" | "Good" | "Fair" | "Needs repair"

// Shape used across the asset UI. `dbId` is the database primary key, `id` is
// the human-facing asset number (e.g. AST-001).
export interface ViewAsset {
  dbId: number
  id: string
  name: string
  description: string
  category: AssetCategory
  serial: string
  price: number
  purchaseDate: string
  disposalDate: string
  condition: AssetCondition
  location: string
  photo: string
  /** True when a gaming machine in Financials is linked to this asset. */
  gamingLinked?: boolean
}

export type MaintenancePriority = "Low" | "Medium" | "High"
export type MaintenanceStatus = "Open" | "In progress" | "Resolved"

/** A single maintenance record linked to an asset. */
export interface MaintenanceRecord {
  id: number
  assetId: number
  issue: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  assignee: string
  /** Cost in pounds (may include pence). */
  cost: number
  /** Display date the work was logged (e.g. "14 Mar 2024"). */
  loggedDate: string
  /** ISO date (YYYY-MM-DD) used to place the job on the calendar. */
  scheduledDate: string
}
