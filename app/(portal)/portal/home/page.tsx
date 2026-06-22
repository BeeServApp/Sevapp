import { getHomeData } from "@/app/actions/portal"
import { HomeView } from "@/components/portal/home-view"

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const data = await getHomeData(week)
  return <HomeView data={data} />
}
