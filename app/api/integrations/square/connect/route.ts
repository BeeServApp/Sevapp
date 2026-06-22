import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { requireOwner } from "@/lib/session"
import { buildAuthorizeUrl, getBaseUrl, squareConfigured } from "@/lib/square"

export const SQUARE_STATE_COOKIE = "square_oauth_state"

export async function GET() {
  // Owner-only. Staff cannot connect integrations.
  try {
    await requireOwner()
  } catch {
    return NextResponse.redirect(`${getBaseUrl()}/sign-in`)
  }

  if (!squareConfigured()) {
    return NextResponse.redirect(
      `${getBaseUrl()}/settings?tab=integrations&square_error=not_configured`,
    )
  }

  const state = randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set(SQUARE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes to complete the OAuth round-trip
  })

  return NextResponse.redirect(buildAuthorizeUrl(state))
}
