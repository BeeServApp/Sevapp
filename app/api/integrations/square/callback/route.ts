import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { squareConnection } from "@/lib/db/schema"
import { encryptSecret } from "@/lib/crypto"
import { getAccountId, getCurrentUser } from "@/lib/session"
import {
  SQUARE_API_BASE,
  SQUARE_SCOPES,
  SQUARE_VERSION,
  exchangeCode,
  getBaseUrl,
} from "@/lib/square"
import { SQUARE_STATE_COOKIE } from "../connect/route"

function settingsRedirect(params: string) {
  return NextResponse.redirect(`${getBaseUrl()}/settings?tab=integrations&${params}`)
}

export async function GET(request: NextRequest) {
  // Must be an authenticated owner.
  let accountId: string
  try {
    const me = await getCurrentUser()
    if (me.appRole !== "owner") return settingsRedirect("square_error=forbidden")
    accountId = await getAccountId()
  } catch {
    return NextResponse.redirect(`${getBaseUrl()}/sign-in`)
  }

  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const returnedState = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(SQUARE_STATE_COOKIE)?.value
  cookieStore.delete(SQUARE_STATE_COOKIE)

  if (oauthError) return settingsRedirect(`square_error=${encodeURIComponent(oauthError)}`)
  if (!code) return settingsRedirect("square_error=missing_code")
  // CSRF: the state echoed by Square must match our httpOnly cookie.
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return settingsRedirect("square_error=state_mismatch")
  }

  try {
    const tokens = await exchangeCode(code)

    // Fetch the merchant profile for a friendly display name.
    let merchantName: string | null = null
    if (tokens.merchant_id) {
      try {
        const res = await fetch(`${SQUARE_API_BASE}/v2/merchants/${tokens.merchant_id}`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "Square-Version": SQUARE_VERSION,
          },
          cache: "no-store",
        })
        if (res.ok) {
          const data = (await res.json()) as { merchant?: { business_name?: string } }
          merchantName = data.merchant?.business_name ?? null
        }
      } catch {
        // Non-fatal: connection still works without a display name.
      }
    }

    const values = {
      accountId,
      merchantId: tokens.merchant_id ?? null,
      merchantName,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      scopes: SQUARE_SCOPES.join(" "),
      expiresAt: tokens.expires_at ? new Date(tokens.expires_at) : null,
      updatedAt: new Date(),
    }

    // Upsert: one Square connection per account.
    const [existing] = await db
      .select({ id: squareConnection.id })
      .from(squareConnection)
      .where(eq(squareConnection.accountId, accountId))
      .limit(1)

    if (existing) {
      await db
        .update(squareConnection)
        .set(values)
        .where(eq(squareConnection.accountId, accountId))
    } else {
      await db.insert(squareConnection).values(values)
    }

    return settingsRedirect("square_connected=1")
  } catch {
    return settingsRedirect("square_error=exchange_failed")
  }
}
