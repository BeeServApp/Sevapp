import { getMyTimecards } from "@/app/actions/scheduling"
import { weekStartOf, dateForDay } from "@/lib/rota"
import { TimecardsView } from "@/components/portal/timecards-view"

export default async function PortalTimecardsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : weekStartOf()
  const weekEnd = dateForDay(weekStart, "Sun")
  const timecards = await getMyTimecards(weekStart, weekEnd)
  return <TimecardsView weekStart={weekStart} timecards={timecards} />
}
