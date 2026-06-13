"use client"

import { useState } from "react"
import { Search, Bell, Plus, Menu, ChevronDown, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AppSidebar } from "@/components/app-sidebar"
import { venue } from "@/lib/mock-data"

export function AppTopbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
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

      <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary">
        <div className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <MapPin className="size-4" />
        </div>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold text-foreground">{venue.name}</p>
          <p className="text-xs text-muted-foreground">{venue.location}</p>
        </div>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      <div className="relative ml-auto hidden max-w-xs flex-1 md:block lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search orders, staff, tasks..."
          className="bg-background pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
        <Button variant="outline" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-card" />
        </Button>
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
            SW
          </AvatarFallback>
        </Avatar>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </header>
  )
}
