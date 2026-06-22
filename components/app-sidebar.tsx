"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import {
  LayoutDashboard,
  ClipboardList,
  ListChecks,
  Wallet,
  Users,
  ShieldCheck,
  Package,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MODULES } from "@/lib/nav-config"
import { useVenue } from "@/components/venue-provider"

const moduleIcons: Record<string, LucideIcon> = {
  "/operations": ClipboardList,
  "/tasks": ListChecks,
  "/assets": Package,
  "/financials": Wallet,
  "/staff": Users,
  "/compliance": ShieldCheck,
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { hiddenModules, appRole } = useVenue()
  const isStaff = appRole === "staff"

  const moduleItems = MODULES.filter((m) => !hiddenModules.includes(m.href)).map((m) => ({
    href: m.href,
    label: m.label,
    icon: moduleIcons[m.href] ?? LayoutDashboard,
  }))

  // Staff get a focused workspace: their schedule and assigned tasks only.
  const sections = isStaff
    ? [
        {
          label: "My workspace",
          items: [
            { href: "/staff", label: "My Schedule", icon: Users },
            { href: "/tasks", label: "Task Management", icon: ListChecks },
          ],
        },
      ]
    : [
        {
          label: "Workspace",
          items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
        },
        ...(moduleItems.length > 0 ? [{ label: "Modules", items: moduleItems }] : []),
      ]

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-20 items-center border-b border-sidebar-border px-5">
        <BrandLogo className="h-12" priority />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/45">
              {section.label}
            </p>
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <ul className="flex flex-col gap-1">
          {!isStaff && (
            <li>
              <Link
                href="/settings"
                onClick={onNavigate}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/settings")
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Settings className="size-4" />
                Settings
              </Link>
            </li>
          )}
          <li>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <LifeBuoy className="size-4" />
              Help & Support
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}
