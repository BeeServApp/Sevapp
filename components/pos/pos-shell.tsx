"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import { Monitor, SlidersHorizontal, LogOut, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { setActiveVenue } from "@/app/actions/venues"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function PosShell({
  venues,
  activeVenueId,
  canManage,
  children,
}: {
  venues: { id: number; name: string }[]
  activeVenueId: number | null
  canManage: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function switchVenue(id: string) {
    startTransition(async () => {
      await setActiveVenue(Number(id))
      router.refresh()
    })
  }

  const navLink = (href: string, label: string, Icon: typeof Monitor) => {
    const active = href === "/pos" ? pathname === "/pos" : pathname.startsWith(href)
    return (
      <Link
        href={href}
        className={cn(
          "flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
        {label}
      </Link>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Monitor className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">Beeserv EPOS</span>
            <span className="text-xs text-muted-foreground">Point of sale</span>
          </div>
        </div>

        <nav className="flex items-center gap-1.5">
          {navLink("/pos", "Till", Monitor)}
          {canManage && navLink("/pos/manage", "Manage", SlidersHorizontal)}
        </nav>

        <div className="flex items-center gap-2">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {venues.length > 1 ? (
            <Select value={activeVenueId ? String(activeVenueId) : undefined} onValueChange={switchVenue}>
              <SelectTrigger className="h-11 w-44">
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="hidden text-sm font-medium text-foreground sm:inline">
              {venues[0]?.name}
            </span>
          )}
          <Link
            href="/dashboard"
            className="flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
