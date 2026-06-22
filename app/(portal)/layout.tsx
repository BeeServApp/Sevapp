import type React from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser, getSession } from "@/lib/session"
import { PortalTabBar } from "@/components/portal/portal-tab-bar"

export const metadata: Metadata = {
  title: "Tapsheet",
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()
  // The mobile portal is the staff experience. Owners use the desktop app.
  if (me.appRole !== "staff") redirect("/dashboard")

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-background">
        <main className="flex-1 px-5 pb-28 pt-3">{children}</main>
        <PortalTabBar />
      </div>
    </div>
  )
}
