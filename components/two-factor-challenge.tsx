"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Smartphone, Mail, KeyRound } from "lucide-react"

type Method = "totp" | "email" | "backup"

export function TwoFactorChallenge() {
  const router = useRouter()
  const [method, setMethod] = useState<Method>("totp")
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  function switchMethod(next: Method) {
    setMethod(next)
    setCode("")
    setError(null)
    setNotice(null)
  }

  async function sendEmailCode() {
    setError(null)
    setLoading(true)
    const { error } = await authClient.twoFactor.sendOtp()
    setLoading(false)
    if (error) {
      setError(error.message ?? "Could not send a code. Try again.")
      return
    }
    setOtpSent(true)
    setNotice("We've emailed you a 6-digit code. It expires shortly.")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmed = code.trim()
    const result =
      method === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: trimmed, trustDevice })
        : method === "email"
          ? await authClient.twoFactor.verifyOtp({ code: trimmed, trustDevice })
          : await authClient.twoFactor.verifyBackupCode({ code: trimmed })

    setLoading(false)
    if (result.error) {
      setError(result.error.message ?? "That code didn't match. Try again.")
      return
    }
    router.push("/")
    router.refresh()
  }

  const label =
    method === "totp"
      ? "Authenticator code"
      : method === "email"
        ? "Emailed code"
        : "Backup code"

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="h-16" priority />
        </div>

        <Card className="p-6">
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Two-factor verification
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm it&apos;s you to finish signing in.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Verification method">
            <MethodTab active={method === "totp"} onClick={() => switchMethod("totp")} icon={Smartphone} label="App" />
            <MethodTab active={method === "email"} onClick={() => switchMethod("email")} icon={Mail} label="Email" />
            <MethodTab active={method === "backup"} onClick={() => switchMethod("backup")} icon={KeyRound} label="Backup" />
          </div>

          {method === "email" && !otpSent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                We&apos;ll email a one-time code to the address on your account.
              </p>
              <Button onClick={sendEmailCode} disabled={loading}>
                {loading ? "Sending..." : "Email me a code"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tf-challenge-code">{label}</Label>
                <Input
                  id="tf-challenge-code"
                  inputMode={method === "backup" ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={method === "backup" ? "xxxxxxxxxx" : "123456"}
                  value={code}
                  onChange={(e) =>
                    setCode(
                      method === "backup"
                        ? e.target.value.trim()
                        : e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  autoFocus
                  required
                />
              </div>

              {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

              {method !== "backup" && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={trustDevice}
                    onCheckedChange={(v) => setTrustDevice(v === true)}
                    aria-label="Trust this device for 30 days"
                  />
                  Trust this device for 30 days
                </label>
              )}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading || !code}>
                {loading ? "Verifying..." : "Verify"}
              </Button>

              {method === "email" && (
                <Button type="button" variant="ghost" size="sm" onClick={sendEmailCode} disabled={loading}>
                  Resend code
                </Button>
              )}
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <a href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
              Back to sign in
            </a>
          </p>
        </Card>
      </div>
    </main>
  )
}

function MethodTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}
