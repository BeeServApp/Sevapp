import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { MarketplaceView } from "@/components/marketplace-view"
import { getCurrentUser, getSession } from "@/lib/session"
import { getInstalledModuleIds } from "@/app/actions/modules"

export const metadata: Metadata = {
  title: "Marketplace — Beeserv",
}

export default async function MarketplacePage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()
  const installed = await getInstalledModuleIds()

  return <MarketplaceView installedModuleIds={installed} canManage={me.appRole === "owner"} />
}
