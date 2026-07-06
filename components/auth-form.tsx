"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { startTrialForPlan } from "@/app/actions/onboarding"
import { getTier } from "@/lib/pricing"

export function AuthForm({ mode, plan }: { mode: "sign-in" | "sign-up"; plan?: string }) {
  const router = useRouter()
  const selectedTier = plan ? getTier(plan) : undefined
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === "sign-up"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password })

    if (error) {
      setLoading(false)
      setError(error.message ?? "Something went wrong")
      return
    }

    // Sign-in with 2FA enabled: Better Auth returns a redirect flag instead of a
    // full session. Send the user to the dedicated challenge page.
    if (!isSignUp && (data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setLoading(false)
      router.push("/two-factor")
      return
    }

    // Pin the new account's card-less trial to the plan they chose on the
    // pricing page so their access is restricted to that plan from day one.
    if (isSignUp) {
      try {
        await startTrialForPlan(plan)
      } catch {
        // Non-fatal: the app layout will still create a default trial row.
      }
    }

    setLoading(false)
    // New owners land in the first-run setup wizard; returning users go home.
    router.push(isSignUp ? "/welcome" : "/")
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-16" priority />
        </div>

        <Card className="p-6">
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignUp
                ? "Start your 3-month free trial — no credit card required"
                : "Sign in to your venue management workspace"}
            </p>
            {isSignUp && selectedTier && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{selectedTier.name} plan</span>
                <span className="text-muted-foreground">selected — free for 3 months</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Sarah Whitfield"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@venue.co.uk"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <Link
              href={isSignUp ? "/sign-in" : "/sign-up"}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
