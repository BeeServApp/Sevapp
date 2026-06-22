"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, History, LayoutPanelTop, User, Menu } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/portal/home", label: "Home", icon: Home },
  { href: "/portal/timecards", label: "Timecards", icon: History },
  { href: "/portal/rota", label: "Rota", icon: LayoutPanelTop },
  { href: "/portal/me", label: "Me", icon: User },
  { href: "/portal/more", label: "More", icon: Menu },
] as const

export function PortalTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-6", active ? "stroke-[2.25]" : "stroke-[1.75]")} aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
