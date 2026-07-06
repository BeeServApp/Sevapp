"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, ShieldAlert, Copy, Check, KeyRound } from "lucide-react"

type Phase = "idle" | "password" | "verify" | "disable"

export function TwoFactorSetup({
  enabled,
  onChange,
}: {
  enabled: boolean
  /** Called after 2FA is successfully enabled (true) or disabled (false). */
  onChange?: (enabled: boolean) => void
}) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [phase, setPhase] = useState<Phase>("idle")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  function reset() {
    setPhase("idle")
    setPassword("")
    setCode("")
    setTotpUri(null)
    setError(null)
    setLoading(false)
  }

  async function startEnable() {
    setError(null)
    setLoading(true)
    const { data, error } = await authClient.twoFactor.enable({ password })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Could not start setup. Check your password.")
      return
    }
    setTotpUri(data?.totpURI ?? null)
    setBackupCodes(data?.backupCodes ?? [])
    setPassword("")
    setPhase("verify")
  }

  async function verifyEnable() {
    setError(null)
    setLoading(true)
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() })
    setLoading(false)
    if (error) {
      setError(error.message ?? "That code didn't match. Try again.")
      return
    }
    setIsEnabled(true)
    setCode("")
    setTotpUri(null)
    setPhase("idle")
    onChange?.(true)
  }

  async function disable() {
    setError(null)
    setLoading(true)
    const { error } = await authClient.twoFactor.disable({ password })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Could not disable. Check your password.")
      return
    }
    setIsEnabled(false)
    setBackupCodes([])
    reset()
    onChange?.(false)
  }

  function copyBackupCodes() {
    navigator.clipboard?.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Enabled + idle ──────────────────────────────────────────────────────────
  if (isEnabled && phase === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">Two-factor authentication is on</span>
          <Badge variant="secondary">Enabled</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          You&apos;ll be asked for a code from your authenticator app, or an emailed code, each time you sign in.
        </p>
        <div>
          <Button variant="outline" onClick={() => setPhase("disable")}>
            Turn off two-factor
          </Button>
        </div>
      </div>
    )
  }

  // ── Disable (password confirm) ───────────────────────────────────────────────
  if (phase === "disable") {
    return (
      <div className="flex max-w-sm flex-col gap-4">
        <p className="text-sm text-muted-foreground">Enter your password to turn off two-factor authentication.</p>
        <div className="grid gap-2">
          <Label htmlFor="tf-disable-pw">Password</Label>
          <Input
            id="tf-disable-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="destructive" onClick={disable} disabled={loading || !password}>
            {loading ? "Turning off..." : "Turn off"}
          </Button>
          <Button variant="ghost" onClick={reset} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── Disabled + idle ──────────────────────────────────────────────────────────
  if (!isEnabled && phase === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">Two-factor authentication is off</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password) plus
          emailed backup codes. Strongly recommended for owner accounts.
        </p>
        <div>
          <Button onClick={() => setPhase("password")}>
            <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
            Enable two-factor
          </Button>
        </div>
      </div>
    )
  }

  // ── Enable step 1: confirm password ──────────────────────────────────────────
  if (phase === "password") {
    return (
      <div className="flex max-w-sm flex-col gap-4">
        <p className="text-sm text-muted-foreground">Confirm your password to begin setting up two-factor authentication.</p>
        <div className="grid gap-2">
          <Label htmlFor="tf-pw">Password</Label>
          <Input
            id="tf-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={startEnable} disabled={loading || !password}>
            {loading ? "Please wait..." : "Continue"}
          </Button>
          <Button variant="ghost" onClick={reset} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── Enable step 2: scan QR + verify ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h4 className="text-sm font-medium text-foreground">1. Scan this QR code</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Open your authenticator app and scan the code below. No app? Enter the setup key manually.
        </p>
      </div>

      {totpUri && (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="rounded-lg border border-border bg-card p-3">
            <QRCodeSVG value={totpUri} size={160} />
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Setup key</span>
            <code className="max-w-[240px] break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
              {new URL(totpUri).searchParams.get("secret")}
            </code>
          </div>
        </div>
      )}

      {backupCodes.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Backup codes</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={copyBackupCodes}>
              {copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Save these somewhere safe. Each code works once if you lose access to your authenticator.
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-foreground">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid max-w-xs gap-2">
        <Label htmlFor="tf-code">2. Enter the 6-digit code</Label>
        <Input
          id="tf-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={verifyEnable} disabled={loading || code.length !== 6}>
          {loading ? "Verifying..." : "Verify & turn on"}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
