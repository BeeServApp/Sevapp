import "server-only"

import { db } from "@/lib/db"
import { squareConnection } from "@/lib/db/schema"
import { encryptSecret, decryptSecret } from "@/lib/crypto"
import { eq } from "drizzle-orm"

// Square production API. Multi-tenant OAuth: each account owner connects their
// own Square account. Tokens are persisted encrypted and auto-refreshed.

export const SQUARE_API_BASE = "https://connect.squareup.com"
export const SQUARE_VERSION = "2025-01-23"
export const SQUARE_SCOPES = ["MERCHANT_PROFILE_READ", "PAYMENTS_READ", "ORDERS_READ"]

export function squareConfigured(): boolean {
  return Boolean(process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_APPLICATION_SECRET)
}

/** App base URL, mirroring the cascade used by Better Auth. */
export function getBaseUrl(): string {
  const url =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL)
  return (url ?? "http://localhost:3000").replace(/\/$/, "")
}

export function getRedirectUri(): string {
  return `${getBaseUrl()}/api/integrations/square/callback`
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SQUARE_APPLICATION_ID ?? "",
    scope: SQUARE_SCOPES.join(" "),
    session: "false",
    state,
    redirect_uri: getRedirectUri(),
  })
  return `${SQUARE_API_BASE}/oauth2/authorize?${params.toString()}`
}

interface SquareTokenResponse {
  access_token: string
  refresh_token: string
  expires_at?: string
  merchant_id?: string
  token_type?: string
}

export async function exchangeCode(code: string): Promise<SquareTokenResponse> {
  const res = await fetch(`${SQUARE_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Square token exchange failed: ${res.status} ${detail}`)
  }
  return res.json()
}

async function refreshAccessToken(refreshToken: string): Promise<SquareTokenResponse> {
  const res = await fetch(`${SQUARE_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Square token refresh failed: ${res.status} ${detail}`)
  }
  return res.json()
}

export interface ActiveConnection {
  accountId: string
  accessToken: string
  merchantId: string | null
  merchantName: string | null
}

/**
 * Returns a usable (decrypted) access token for the account, refreshing and
 * re-persisting it when it is within 24h of expiry. Returns null if the account
 * has no Square connection.
 */
async function getValidAccessToken(accountId: string): Promise<ActiveConnection | null> {
  const [conn] = await db
    .select()
    .from(squareConnection)
    .where(eq(squareConnection.accountId, accountId))
    .limit(1)
  if (!conn) return null

  let accessToken = decryptSecret(conn.accessToken)
  const expiresSoon =
    conn.expiresAt != null && conn.expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000

  if (expiresSoon) {
    const refreshed = await refreshAccessToken(decryptSecret(conn.refreshToken))
    accessToken = refreshed.access_token
    await db
      .update(squareConnection)
      .set({
        accessToken: encryptSecret(refreshed.access_token),
        // Square may rotate the refresh token; persist the new one when present.
        refreshToken: refreshed.refresh_token
          ? encryptSecret(refreshed.refresh_token)
          : conn.refreshToken,
        expiresAt: refreshed.expires_at ? new Date(refreshed.expires_at) : conn.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(squareConnection.accountId, accountId))
  }

  return {
    accountId,
    accessToken,
    merchantId: conn.merchantId,
    merchantName: conn.merchantName,
  }
}

/** Authenticated Square API fetch for a given account (auto-refreshes tokens). */
export async function squareFetch<T = unknown>(
  accountId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const conn = await getValidAccessToken(accountId)
  if (!conn) throw new Error("No Square connection for this account.")

  const res = await fetch(`${SQUARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Square API ${path} failed: ${res.status} ${detail}`)
  }
  return res.json() as Promise<T>
}
