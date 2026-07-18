"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ListChecks,
  Wallet,
  Users,
  ShieldCheck,
  UtensilsCrossed,
  GraduationCap,
  Package,
  Boxes,
  Settings,
  LifeBuoy,
  Building2,
  Store,
  Monitor,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CALENDAR_ITEM, MODULES, allowedModulePathsForRole } from "@/lib/nav-config"
import { useVenue } from "@/components/venue-provider"

const moduleIcons: Record<string, LucideIcon> = {
  "/calendar": CalendarDays,
  "/operations": ClipboardList,
  "/stock": Boxes,
  "/tasks": ListChecks,
  "/assets": Package,
  "/financials": Wallet,
  "/staff": Users,
  "/compliance": ShieldCheck,
  "/food": UtensilsCrossed,
  "/training": GraduationCap,
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { hiddenModules, installedModules, appRole, managerRole } = useVenue()
  const eposInstalled = installedModules.includes("epos")
  const isStaff = appRole === "staff"
  // Managers and area managers get the workspace Calendar even though they are
  // staff logins.
  const canSeeCalendar = !isStaff || managerRole != null

  const calendarItem = { href: CALENDAR_ITEM.href, label: CALENDAR_ITEM.label, icon: CalendarDays }

  // Staff are limited to their focused module set (managers additionally get
  // Operations), minus any they have personally hidden. Owners see the
  // Dashboard plus every module they haven't hidden company-wide.
  const staffAllowedPaths = allowedModulePathsForRole(appRole, managerRole)
  const moduleItems = MODULES.filter((m) => {
    if (isStaff) return staffAllowedPaths.includes(m.href) && !hiddenModules.includes(m.href)
    return !hiddenModules.includes(m.href)
  }).map((m) => ({
    href: m.href,
    label: m.label,
    icon: moduleIcons[m.href] ?? LayoutDashboard,
  }))

  const sections = isStaff
    ? [
        ...(canSeeCalendar ? [{ label: "Workspace", items: [calendarItem] }] : []),
        ...(moduleItems.length > 0 ? [{ label: "Modules", items: moduleItems }] : []),
      ]
    : [
        {
          label: "Workspace",
          items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            calendarItem,
          ],
        },
        {
          label: "Group",
          items: [
            { href: "/dashboard/group", label: "Group overview", icon: Building2 },
            { href: "/assets/group", label: "Group assets", icon: Package },
            { href: "/compliance/group", label: "Group compliance", icon: ShieldCheck },
            { href: "/stock/group", label: "Group stock", icon: Boxes },
          ],
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
                const active = isItemActive(pathname, item.href)
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
          {eposInstalled && (
            <li>
              <Link
                href="/pos"
                onClick={onNavigate}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/pos")
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Monitor className="size-4" />
                EPOS Till
              </Link>
            </li>
          )}
          <li>
            <Link
              href="/marketplace"
              onClick={onNavigate}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/marketplace")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Store className="size-4" />
              Marketplace
            </Link>
          </li>
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
