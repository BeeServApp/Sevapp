import { getTeamWeekShifts } from "@/app/actions/portal"
import { weekStartOf } from "@/lib/rota"
import { RotaView } from "@/components/portal/rota-view"

export default async function PortalRotaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : weekStartOf()
  const { venueName, shifts } = await getTeamWeekShifts(weekStart)
  return <RotaView weekStart={weekStart} venueName={venueName} shifts={shifts} />
}
