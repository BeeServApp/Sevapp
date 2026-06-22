"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarCheck, History, LifeBuoy, User, ChevronRight, LogOut } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { PortalHeader } from "@/components/portal/portal-header"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/portal/me", label: "My availability", icon: CalendarCheck },
  { href: "/portal/timecards", label: "Timecards", icon: History },
  { href: "/portal/me", label: "Profile", icon: User },
] as const

export function MoreView() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

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
      <PortalHeader title="More" />

      <Card>
        <CardContent className="flex flex-col">
          {LINKS.map((item, i) => {
            const Icon = item.icon
            return (
              <Link
                key={`${item.href}-${i}`}
                href={item.href}
                className="flex items-center gap-3 border-b border-border py-3 transition-colors active:bg-muted"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            )
          })}
          <a
            href="mailto:support@tapsheet.app"
            className="flex items-center gap-3 py-3 transition-colors active:bg-muted"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LifeBuoy className="size-4" />
            </span>
            <span className="flex-1 text-sm font-medium text-foreground">Help &amp; support</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>

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
