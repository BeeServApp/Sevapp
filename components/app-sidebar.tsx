"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Wallet,
  Users,
  ShieldCheck,
  Package,
  Beer,
  Settings,
  LifeBuoy,
} from "lucide-react"
import { cn } from "@/lib/utils"

const sections = [
  {
    label: "Workspace",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Modules",
    items: [
      { href: "/operations", label: "Operations", icon: ClipboardList },
      { href: "/assets", label: "Asset Tracking", icon: Package },
      { href: "/financials", label: "Financials", icon: Wallet },
      { href: "/staff", label: "Staff & Scheduling", icon: Users },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck },
    ],
  },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <Beer className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-heading text-sm font-semibold text-sidebar-accent-foreground">Tapsheet</p>
          <p className="text-xs text-sidebar-foreground/70">Powering hospitality ops</p>
        </div>
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
                  item.href === "/"
                    ? pathname === "/"
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
