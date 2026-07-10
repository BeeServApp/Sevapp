"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, ClipboardList, Clock, Gauge, Lock, Music, Package, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminMenu } from "@/components/kiosk/admin-menu"
import type { KioskNav } from "@/components/kiosk/kiosk-root"

interface KioskShellProps {
  venueName: string
  hasAdminPin: boolean
  alert: { alert: boolean; reasons: string[] }
  nav: KioskNav
  onNav: (n: KioskNav) => void
  onMusic: () => void
  onUnpaired: () => void
  children: React.ReactNode
}

const NAV_ITEMS: { key: KioskNav; label: string; icon: typeof Gauge }[] = [
  { key: "home", label: "Clock", icon: Clock },
  { key: "dashboard", label: "Dashboard", icon: Gauge },
  { key: "tasks", label: "Tasks", icon: ClipboardList },
  { key: "stock", label: "Stock", icon: Package },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
]

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!now) return null
  return (
    <div className="text-right leading-tight">
      <div className="text-2xl font-semibold tabular-nums">
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="text-xs text-muted-foreground">
        {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
      </div>
    </div>
  )
}

export function KioskShell({
  venueName,
  hasAdminPin,
  alert,
  nav,
  onNav,
  onMusic,
  onUnpaired,
  children,
}: KioskShellProps) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Keep the screen awake while the kiosk is running.
  useEffect(() => {
    let cancelled = false
    async function acquire() {
      try {
        const anyNav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } }
        if (anyNav.wakeLock && document.visibilityState === "visible") {
          wakeLockRef.current = await anyNav.wakeLock.request("screen")
        }
      } catch {
        /* wake lock unavailable — ignore */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire()
    }
    acquire()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [])

  // Block context menu and browser back navigation while locked.
  useEffect(() => {
    const blockContext = (e: Event) => e.preventDefault()
    const blockPop = () => window.history.pushState(null, "", window.location.href)
    document.addEventListener("contextmenu", blockContext)
    window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", blockPop)
    return () => {
      document.removeEventListener("contextmenu", blockContext)
      window.removeEventListener("popstate", blockPop)
    }
  }, [])

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      {/* Alert overlay — non-blocking so staff can still act to clear it. */}
      {alert.alert && (
        <>
          <div
            aria-hidden
            className="kiosk-alert-overlay pointer-events-none fixed inset-0 z-40 rounded-none"
          />
          <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3">
            <div className="flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-white shadow-lg">
              <AlertTriangle className="size-4" />
              <span>{alert.reasons.join(" · ")}</span>
            </div>
          </div>
        </>
      )}

      {/* Top bar */}
      <header className="z-30 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          <div>
            <div className="text-lg font-semibold leading-tight">{venueName}</div>
            <div className="text-xs text-muted-foreground">Beeserv Kiosk</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock />
          <button
            type="button"
            onClick={onMusic}
            aria-label="Music"
            className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border active:scale-95"
          >
            <Music className="size-5" />
          </button>
          <AdminMenu hasAdminPin={hasAdminPin} onUnpaired={onUnpaired}>
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border active:scale-95">
              <Lock className="size-5" />
            </span>
          </AdminMenu>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-30 flex-1 overflow-y-auto p-6">{children}</main>

      {/* Bottom nav */}
      <nav className="z-30 grid grid-cols-5 gap-1 border-t border-border bg-card/90 px-2 py-2 backdrop-blur">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = nav === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNav(item.key)}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition active:scale-95",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-6" />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
