import { redirect } from "next/navigation"
import { AssetsView } from "@/components/assets-view"
import { getActiveVenueId, getSession } from "@/lib/session"
import { getAssets } from "@/app/actions/assets"
import type { AssetCategory, AssetCondition, ViewAsset } from "@/lib/asset-types"

export default async function AssetsPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const venueId = await getActiveVenueId(session.user.id)
  if (!venueId) {
    return (
      <p className="text-sm text-muted-foreground">
        No venue selected. Add a venue in Settings to start tracking assets.
      </p>
    )
  }

  const rows = await getAssets(venueId)
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
  }))

  return <AssetsView initialAssets={assets} venueId={venueId} />
}
