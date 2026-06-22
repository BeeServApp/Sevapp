"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarCheck, History, LifeBuoy, User, ChevronRight, LogOut } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { PortalHeader } from "@/components/portal/portal-header"

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
    <div>
      <PortalHeader title="More" />

      <ul className="mt-2 flex flex-col">
        {LINKS.map((item, i) => {
          const Icon = item.icon
          return (
            <li key={`${item.href}-${i}`}>
              <Link
                href={item.href}
                className="flex items-center gap-3 border-b border-border py-4 transition-colors active:bg-muted"
              >
                <Icon className="size-5 text-muted-foreground" />
                <span className="flex-1 text-base font-semibold text-foreground">{item.label}</span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </li>
          )
        })}
        <li>
          <a
            href="mailto:support@tapsheet.app"
            className="flex items-center gap-3 border-b border-border py-4 transition-colors active:bg-muted"
          >
            <LifeBuoy className="size-5 text-muted-foreground" />
            <span className="flex-1 text-base font-semibold text-foreground">Help &amp; support</span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </a>
        </li>
      </ul>

      <div className="py-8">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3.5 text-base font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <LogOut className="size-5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  )
}
