import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { eq } from "drizzle-orm"
import { pool, db } from "@/lib/db"
import { user } from "@/lib/db/schema"

export const auth = betterAuth({
  database: pool,
  databaseHooks: {
    session: {
      create: {
        // Block deactivated accounts from establishing a new session (re-login).
        async before(session) {
          const [row] = await db
            .select({ disabledAt: user.disabledAt })
            .from(user)
            .where(eq(user.id, session.userId))
            .limit(1)
          if (row?.disabledAt) {
            throw new APIError("FORBIDDEN", {
              message: "This account has been deactivated. Please contact your administrator.",
            })
          }
          return { data: session }
        },
      },
    },
  },
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", `http://localhost:${process.env.PORT ?? 3000}`]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
