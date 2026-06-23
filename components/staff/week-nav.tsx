"use client"

import { useRouter } from "next/navigation"
import { useRef, useTransition } from "react"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addWeeks, weekStartOf, weekRangeLabel } from "@/lib/rota"
import { cn } from "@/lib/utils"

export function WeekNav({ weekStart, className }: { weekStart: string; className?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const dateRef = useRef<HTMLInputElement>(null)

  function go(week: string) {
    startTransition(() => router.push(`/staff?week=${week}`))
  }

  function jumpToDate(value: string) {
    if (!value) return
    go(weekStartOf(new Date(`${value}T00:00:00`)))
  }

  function openDatePicker() {
    const el = dateRef.current
    if (!el) return
    // showPicker() is the reliable way to open a native date picker on click.
    // Fall back to focus()/click() on browsers that don't support it.
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
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
      <div className="relative inline-flex">
        <Button variant="outline" size="sm" className="gap-2" onClick={openDatePicker}>
          <CalendarDays className="size-3.5" />
          Jump to date
        </Button>
        <input
          ref={dateRef}
          type="date"
          value={weekStart}
          onChange={(e) => jumpToDate(e.target.value)}
          aria-label="Jump to a week by date"
          // Kept in the DOM (not display:none) so showPicker() can anchor to it,
          // but visually hidden and non-interactive on its own.
          className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
          tabIndex={-1}
        />
      </div>
      {!isThisWeek && (
        <Button variant="outline" size="sm" onClick={() => go(weekStartOf())}>
          Today
        </Button>
      )}
    </div>
  )
}
