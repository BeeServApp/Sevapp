"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfile } from "@/app/actions/account"

export function AccountSettings({ user }: { user: { name: string; email: string } }) {
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
  )
}
