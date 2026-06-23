import type React from "react"
import { redirect } from "next/navigation"
import { getCurrentUser, getSession } from "@/lib/session"

// The mobile bottom-bar portal has been retired. Both staff and owners now use
// the sidebar-based app shell, so any /portal/* request is redirected there:
// staff land on Staff & Scheduling, owners on their dashboard.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()
  redirect(me.appRole === "staff" ? "/staff" : "/dashboard")

  // Unreachable — kept so the layout still satisfies the segment's type contract.
  return <>{children}</>
}
