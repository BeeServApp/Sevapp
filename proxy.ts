import { NextResponse, type NextRequest } from "next/server"

/**
 * Host-based routing for the EPOS module.
 *
 * The till is served from the `pos.beeserv.app` subdomain but lives under the
 * `/pos` route tree in this app. When a request arrives on the `pos.*`
 * subdomain we transparently rewrite it onto `/pos/...` so the same deployment
 * serves both the main app and the till.
 *
 * Locally you can test with `pos.localhost:3000`.
 *
 * NOTE: for auth/session cookies to be shared between the main app and the
 * `pos.` subdomain in production, the Better Auth cookie domain must be set to
 * the parent domain (e.g. `.beeserv.app`). That is a deploy-time auth config,
 * separate from this routing rewrite.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? ""
  const hostname = host.split(":")[0].toLowerCase()

  // The POS subdomain is any host whose first label is exactly "pos"
  // (e.g. pos.beeserv.app, pos.localhost).
  const isPosSubdomain = hostname === "pos" || hostname.startsWith("pos.")

  if (isPosSubdomain) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith("/pos")) {
      url.pathname = url.pathname === "/" ? "/pos" : `/pos${url.pathname}`
      return NextResponse.rewrite(url)
    }
  }

  // The kiosk subdomain (`kiosk.beeserv.app`) is served from the `/kiosk`
  // route tree in the same way as the POS subdomain above.
  const isKioskSubdomain = hostname === "kiosk" || hostname.startsWith("kiosk.")

  if (isKioskSubdomain) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith("/kiosk")) {
      url.pathname = url.pathname === "/" ? "/kiosk" : `/kiosk${url.pathname}`
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|json)$).*)"],
}
