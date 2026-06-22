"use client"

import { useMemo } from "react"
import Link from "next/link"
import useSWR from "swr"
import { AlertTriangle, Bell, CalendarClock, ClipboardCheck, FileWarning, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useVenue } from "@/components/venue-provider"
import { getNotifications, type Notification } from "@/app/actions/safety"

const ICONS: Record<Notification["kind"], typeof Bell> = {
  overdue: AlertTriangle,
  expiring: FileWarning,
  checklist: ClipboardCheck,
  action: Wrench,
  review: CalendarClock,
}

const SEVERITY_STYLES: Record<Notification["severity"], string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  info: "bg-primary/10 text-primary",
}

export function NotificationCenter() {
  const { activeVenue } = useVenue()
  const venueId = activeVenue?.id ?? null

  const { data, isLoading } = useSWR(
    venueId ? ["notifications", venueId] : null,
    () => getNotifications(venueId as number),
    { refreshInterval: 60_000, revalidateOnFocus: true },
  )

  const notifications = useMemo(() => data ?? [], [data])
  const count = notifications.length
  const dangerCount = notifications.filter((n) => n.severity === "danger").length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label={`Notifications${count ? `, ${count} unread` : ""}`} className="relative" />
        }
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-card ${
              dangerCount > 0 ? "bg-destructive" : "bg-primary"
            }`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {count} to action
            </span>
          )}
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : count === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-secondary">
                <Bell className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">No overdue checks, expiries or open actions.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const Icon = ICONS[n.kind]
                return (
                  <li key={n.id}>
                    <Link
                      href={`/compliance?tab=${n.tab}`}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary"
                    >
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${SEVERITY_STYLES[n.severity]}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{n.title}</span>
                        <span className="block text-xs text-muted-foreground">{n.detail}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full justify-center" render={<Link href="/compliance" />}>
            View safety management
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
