"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { addWeeks, weekStartOf, weekRangeLabel } from "@/lib/rota"
import { cn } from "@/lib/utils"

/** Parse a yyyy-mm-dd week start into a local-noon Date (timezone-safe). */
function weekStartToDate(weekStart: string): Date {
  const [y, m, d] = weekStart.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function WeekNav({ weekStart, className }: { weekStart: string; className?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)

  function go(week: string) {
    startTransition(() => router.push(`/staff?week=${week}`))
  }

  function jumpToDate(date: Date | undefined) {
    if (!date) return
    setPickerOpen(false)
    // weekStartOf snaps the chosen day to that week's Monday using local time.
    go(weekStartOf(date))
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
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
          <CalendarDays className="size-3.5" />
          Jump to date
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={weekStartToDate(weekStart)}
            defaultMonth={weekStartToDate(weekStart)}
            onSelect={jumpToDate}
            weekStartsOn={1}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {!isThisWeek && (
        <Button variant="outline" size="sm" onClick={() => go(weekStartOf())}>
          Today
        </Button>
      )}
    </div>
  )
}
