"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addWeeks, weekStartOf, weekRangeLabel } from "@/lib/rota"
import { cn } from "@/lib/utils"

export function WeekNav({ weekStart, className }: { weekStart: string; className?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function go(week: string) {
    startTransition(() => router.push(`/staff?week=${week}`))
  }

  const isThisWeek = weekStart === weekStartOf()

  return (
    <div className={cn("flex items-center gap-2", isPending && "opacity-60", className)}>
      <div className="flex items-center rounded-lg border border-border">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-r-none"
          onClick={() => go(addWeeks(weekStart, -1))}
          aria-label="Previous week"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex min-w-[150px] items-center justify-center gap-2 border-x border-border px-3 text-sm font-medium">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {weekRangeLabel(weekStart)}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-l-none"
          onClick={() => go(addWeeks(weekStart, 1))}
          aria-label="Next week"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {!isThisWeek && (
        <Button variant="outline" size="sm" onClick={() => go(weekStartOf())}>
          Today
        </Button>
      )}
    </div>
  )
}
