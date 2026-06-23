"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { setAvailability } from "@/app/actions/scheduling"
import { PortalHeader } from "@/components/portal/portal-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DbAvailability } from "@/lib/db/schema"

const AVAIL_CYCLE = ["available", "preferred", "unavailable"] as const
type AvailStatus = (typeof AVAIL_CYCLE)[number]

const availStyles: Record<AvailStatus, { label: string; cls: string }> = {
  available: { label: "Available", cls: "bg-muted text-muted-foreground" },
  preferred: { label: "Prefer", cls: "bg-chart-2/15 text-chart-2" },
  unavailable: { label: "Can't work", cls: "bg-destructive/12 text-destructive" },
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface MeViewProps {
  name: string
  email: string
  role: string | null
  venueId: number
  staffMemberId: number | null
  rotaDays: string[]
  initialAvailability: DbAvailability[]
}

export function MeView({
  name,
  email,
  role,
  venueId,
  staffMemberId,
  rotaDays,
  initialAvailability,
}: MeViewProps) {
  const router = useRouter()
  const [availability, setAvailabilityState] = useState<DbAvailability[]>(initialAvailability)
  const [signingOut, setSigningOut] = useState(false)
  const [, startTransition] = useTransition()

  const availByDay = useMemo(() => {
    const m = new Map<string, DbAvailability>()
    for (const a of availability) m.set(a.day, a)
    return m
  }, [availability])

  function cycleAvailability(day: string) {
    if (staffMemberId == null) return
    const current = (availByDay.get(day)?.status as AvailStatus) ?? "available"
    const next = AVAIL_CYCLE[(AVAIL_CYCLE.indexOf(current) + 1) % AVAIL_CYCLE.length]
    setAvailabilityState((prev) => {
      const others = prev.filter((a) => a.day !== day)
      return [
        ...others,
        {
          id: availByDay.get(day)?.id ?? -Date.now(),
          userId: "",
          venueId,
          staffMemberId,
          day,
          status: next,
          startTime: null,
          endTime: null,
          note: null,
          createdAt: new Date(),
        } as DbAvailability,
      ]
    })
    startTransition(async () => {
      await setAvailability({ venueId, staffMemberId, day, status: next })
    })
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      router.push("/sign-in")
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PortalHeader title="Me" />

      {/* Profile */}
      <Card>
        <CardContent className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {initialsOf(name)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-foreground">{name}</div>
            <div className="truncate text-sm text-muted-foreground">{role || "Team member"}</div>
            <div className="truncate text-sm text-muted-foreground">{email}</div>
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader>
          <CardTitle>My availability</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap a day to cycle: Available, Prefer, Can&apos;t work. Your manager sees this on the rota.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col">
          {rotaDays.map((day, i) => {
            const status = (availByDay.get(day)?.status as AvailStatus) ?? "available"
            const style = availStyles[status]
            return (
              <button
                key={day}
                type="button"
                onClick={() => cycleAvailability(day)}
                className={cn(
                  "flex items-center justify-between py-3 text-left transition-colors active:bg-muted",
                  i < rotaDays.length - 1 && "border-b border-border",
                )}
              >
                <span className="text-sm font-medium text-foreground">{day}</span>
                <span className={cn("rounded-md px-2.5 py-1 text-xs font-medium", style.cls)}>{style.label}</span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
      >
        <LogOut className="size-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  )
}
