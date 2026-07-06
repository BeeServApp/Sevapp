"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, ShieldAlert, MailCheck, MailWarning } from "lucide-react"
import { updateProfile, resendVerification, type SecurityState } from "@/app/actions/account"
import { TwoFactorSetup } from "@/components/two-factor-setup"

export function AccountSettings({
  user,
  security,
}: {
  user: { name: string; email: string }
  security?: SecurityState
}) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateProfile({ name })
      setMessage("Profile updated.")
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Your personal account details.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid max-w-md gap-4">
            <div className="grid gap-2">
              <Label htmlFor="account-name">Full name</Label>
              <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" value={user.email} disabled readOnly />
              <p className="text-xs text-muted-foreground">Your sign-in email cannot be changed here.</p>
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <div>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {security && <EmailVerificationCard verified={security.emailVerified} />}

      {security && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Two-factor authentication</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a second step at sign-in using an authenticator app or emailed codes.
                </p>
              </div>
              {security.twoFactorEnabled ? (
                <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  On
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <ShieldAlert className="size-3.5" aria-hidden />
                  Off
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <TwoFactorSetup enabled={security.twoFactorEnabled} onChange={() => router.refresh()} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EmailVerificationCard({ verified }: { verified: boolean }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleResend() {
    setSending(true)
    try {
      const res = await resendVerification()
      setSent(res.ok)
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Email verification</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm your email so we can send security alerts and account recovery links.
            </p>
          </div>
          {verified ? (
            <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
              <MailCheck className="size-3.5" aria-hidden />
              Verified
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <MailWarning className="size-3.5" aria-hidden />
              Unverified
            </Badge>
          )}
        </div>
      </CardHeader>
      {!verified && (
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Verification email sent. Check your inbox and click the link to confirm.
            </p>
          ) : (
            <Button variant="outline" onClick={handleResend} disabled={sending}>
              {sending ? "Sending..." : "Resend verification email"}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
