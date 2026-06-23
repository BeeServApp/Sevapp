import { redirect } from "next/navigation"
import { AssetsView } from "@/components/assets-view"
import { getActiveVenueId, getSession, guardOwnerPage } from "@/lib/session"
import { getAssets, getAssetMaintenance } from "@/app/actions/assets"
import { getGamingMachines } from "@/app/actions/gaming"
import { getVenues } from "@/app/actions/venues"
import type {
  AssetCategory,
  AssetCondition,
  MaintenancePriority,
  MaintenanceRecord,
  MaintenanceStatus,
  ViewAsset,
} from "@/lib/asset-types"

export default async function AssetsPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")
  await guardOwnerPage()

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start tracking assets.
      </p>
    )
  }

  const [rows, machines, maintenanceRows, venueRows] = await Promise.all([
    getAssets(venueId),
    getGamingMachines(venueId),
    getAssetMaintenance(venueId),
    getVenues(),
  ])
  const venues = venueRows.map((v) => ({ id: v.id, name: v.name }))
  const linkedAssetIds = new Set(
    machines.map((m) => m.assetId).filter((id): id is number => id != null),
  )

  const maintenance: MaintenanceRecord[] = maintenanceRows
    .filter((m) => m.assetId != null)
    .map((m) => ({
      id: m.id,
      assetId: m.assetId as number,
      issue: m.issue ?? "",
      priority: (m.priority as MaintenancePriority) ?? "Medium",
      status: (m.status as MaintenanceStatus) ?? "Open",
      assignee: m.assignee ?? "",
      cost: (m.costPence ?? 0) / 100,
      loggedDate: m.loggedDate ?? "",
    }))
  const assets: ViewAsset[] = rows.map((a) => ({
    dbId: a.id,
    id: a.assetNumber,
    name: a.name,
    description: a.description ?? "",
    category: a.category as AssetCategory,
    serial: a.serial ?? "—",
    price: a.price,
    purchaseDate: a.purchaseDate ?? "",
    disposalDate: a.disposalDate ?? "",
    condition: a.condition as AssetCondition,
    location: a.location ?? "Unassigned",
    photo: a.photo ?? "/placeholder.svg",
    gamingLinked: linkedAssetIds.has(a.id),
  }))

  return (
    <AssetsView
      key={venueId}
      initialAssets={assets}
      initialMaintenance={maintenance}
      venueId={venueId}
      venues={venues}
    />
  )
}
