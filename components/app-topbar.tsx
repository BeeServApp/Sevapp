"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  Search,
  Menu,
  ChevronDown,
  MapPin,
  Check,
  Plus,
  Settings,
  LogOut,
  Building2,
  ShieldCheck,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AppSidebar } from "@/components/app-sidebar"
import { NotificationCenter } from "@/components/notification-center"
import { useVenue } from "@/components/venue-provider"
import { BusinessSwitcher } from "@/components/business-switcher"
import { authClient } from "@/lib/auth-client"

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  )
}

export function AppTopbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { venues, activeVenue, user, switchVenue, appRole, businesses, isSuperAdmin } = useVenue()

  const isOwner = appRole === "owner"
  const isGroupView = pathname === "/dashboard/group"

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      {/* Business switcher (one login can own several businesses) */}
      {isOwner && businesses.length > 0 && (
        <>
          <BusinessSwitcher businesses={businesses} />
          <div className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
        </>
      )}

      {/* Venue switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary" />
          }
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            {isGroupView ? <Building2 className="size-4" /> : <MapPin className="size-4" />}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold text-foreground">
              {isGroupView ? "Group overview" : (activeVenue?.name ?? "No venue")}
            </p>
            <p className="text-xs text-muted-foreground">
              {isGroupView
                ? "All venues"
                : (activeVenue?.city ?? activeVenue?.type ?? "Add a venue")}
            </p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {isOwner && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Group</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/dashboard/group" />}>
                <Building2 className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">Group overview</span>
                {isGroupView && <Check className="size-4 text-brand" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Switch venue</DropdownMenuLabel>
          </DropdownMenuGroup>
          {venues.map((v) => (
            <DropdownMenuItem key={v.id} onClick={() => switchVenue(v.id)}>
              <MapPin className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{v.name}</span>
              {!isGroupView && v.id === activeVenue?.id && <Check className="size-4 text-brand" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings?tab=venues" />}>
            <Plus className="size-4" />
            Add / manage venues
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="relative ml-auto hidden max-w-xs flex-1 md:block lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search orders, staff, tasks..." className="bg-background pl-9" />
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <NotificationCenter />

        {/* Account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="rounded-full outline-none" aria-label="Account menu" />
            }
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            {isSuperAdmin && (
              <DropdownMenuItem render={<Link href="/admin" />}>
                <ShieldCheck className="size-4" />
                Admin console
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
