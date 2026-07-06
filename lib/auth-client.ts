"use client"

import { createAuthClient } from "better-auth/react"
import { twoFactorClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // When a signed-in user still needs to pass a 2FA challenge, Better Auth
      // triggers this redirect. We send them to the dedicated challenge page.
      onTwoFactorRedirect() {
        window.location.href = "/two-factor"
      },
    }),
  ],
})

export const { signIn, signUp, signOut, useSession, twoFactor } = authClient
