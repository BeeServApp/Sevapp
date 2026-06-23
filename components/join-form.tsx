"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { acceptStaffInvite } from "@/app/actions/invites"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

export function JoinForm({
  token,
  staffName,
  roleLabel,
  venueName,
  presetEmail,
}: {
  token: string
  staffName: string
  roleLabel: string
  venueName: string
  presetEmail: string
}) {
  const router = useRouter()
  const [name, setName] = useState(staffName)
  const [email, setEmail] = useState(presetEmail)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await acceptStaffInvite({ token, name, email, password })
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }
    // acceptStaffInvite auto-signs the new staff account in.
    router.push("/staff")
    router.refresh()
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <p className="text-sm font-medium text-brand">{venueName}</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
          Join the team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {staffName ? `Hi ${staffName.split(" ")[0]}, set` : "Set"} up your login as{" "}
          <span className="font-medium text-foreground">{roleLabel}</span> to see your shifts and tasks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@email.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Create a password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Setting up..." : "Create my account"}
        </Button>
      </form>
    </Card>
  )
}
