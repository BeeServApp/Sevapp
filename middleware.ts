import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Routes the `kiosk.beeserv.app` subdomain to the `/kiosk` route group so the
 * dedicated iPad kiosk is served from its own hostname. Everything else passes
 * through untouched. In local/dev or on the main domain, `/kiosk` is reachable
 * directly for testing.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase()
  const url = req.nextUrl

  const isKioskHost = host === "kiosk.beeserv.app" || host.startsWith("kiosk.")
  if (isKioskHost && !url.pathname.startsWith("/kiosk")) {
    url.pathname = url.pathname === "/" ? "/kiosk" : `/kiosk${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  // Skip Next internals and static assets; run on everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
