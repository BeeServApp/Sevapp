import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { MarketplaceView } from "@/components/marketplace-view"
import { getSession } from "@/lib/session"

export const metadata: Metadata = {
  title: "Marketplace — Beeserv",
}

export default async function MarketplacePage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  return <MarketplaceView />
}
