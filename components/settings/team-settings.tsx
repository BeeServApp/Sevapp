"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Copy, Check, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createStaffMember, deleteStaffMember } from "@/app/actions/staff"
import { createStaffInvite, revokeStaffInvite } from "@/app/actions/invites"
import type { DbStaffMember } from "@/lib/db/schema"

export type TeamMember = DbStaffMember
export type InviteStatusMap = Record<number, { status: string; token: string }>

const roles = ["Manager", "Supervisor", "Bar Staff", "Kitchen", "Staff"]

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  )
}

function AddMemberDialog({ venueId }: { venueId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("Staff")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Name is required.")
    if (!email.trim()) return setError("Email is required.")
    setSaving(true)
    setError(null)
    try {
      await createStaffMember({
        venueId,
        name: name.trim(),
        role,
        contract: "Full-time",
        hoursWk: 0,
        status: "Off",
        email: email.trim(),
      })
      setName("")
      setEmail("")
      setRole("Staff")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-1.5">
            <Plus className="size-4" /> Add member
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Adds a person to the staff directory. Send them an app-access invite once added.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="member-name">Full name</Label>
            <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mia Roberts" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@venue.co.uk"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="member-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v ?? "Staff")}>
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamSettings({
  staff,
  inviteStatuses: initialInviteStatuses,
  venueId,
  venueName,
}: {
  staff: TeamMember[]
  inviteStatuses: InviteStatusMap
  venueId: number
  venueName: string
}) {
  const router = useRouter()
  const [inviteStatuses, setInviteStatuses] = useState<InviteStatusMap>(initialInviteStatuses)
  const [invitingId, setInvitingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  function inviteUrl(token: string) {
    if (typeof window === "undefined") return `/join/${token}`
    return `${window.location.origin}/join/${token}`
  }

  async function handleInvite(m: TeamMember) {
    setInvitingId(m.id)
    try {
      const inv = await createStaffInvite(m.id, m.email ?? undefined)
      setInviteStatuses((prev) => ({ ...prev, [m.id]: { status: "pending", token: inv.token } }))
      try {
        await navigator.clipboard.writeText(inviteUrl(inv.token))
        setCopiedId(m.id)
        setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 2000)
      } catch {
        /* clipboard may be blocked; link is still shown */
      }
    } finally {
      setInvitingId(null)
    }
  }

  async function handleCopyInvite(m: TeamMember, token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setCopiedId(m.id)
      setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 2000)
    } catch {
      /* ignore */
    }
  }

  async function handleRevoke(m: TeamMember) {
    await revokeStaffInvite(m.id)
    setInviteStatuses((prev) => {
      const next = { ...prev }
      delete next[m.id]
      return next
    })
  }

  async function handleRemove(m: TeamMember) {
    if (!confirm(`Remove ${m.name} from the team?`)) return
    setBusyId(m.id)
    try {
      await deleteStaffMember(m.id)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Team &amp; users</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            People in the {venueName} staff directory. Invite them to give app access, then set their
            permission level under Manager access below.
          </p>
        </div>
        <AddMemberDialog venueId={venueId} />
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {staff.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No team members yet. Add your first one.
            </li>
          )}
          {staff.map((m) => {
            const invite = inviteStatuses[m.id]
            const linked = !!m.linkedUserId
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-4">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{m.name}</p>
                    <StatusBadge status={m.status} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.email || "No email"} · {m.role}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {linked ? (
                    <Badge variant="outline" className="border-transparent bg-chart-2/15 text-chart-2">
                      <Check className="size-3" /> Linked
                    </Badge>
                  ) : invite?.status === "pending" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => handleCopyInvite(m, invite.token)}
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="size-3.5" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" /> Copy link
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevoke(m)}
                      >
                        Revoke
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={invitingId === m.id}
                      onClick={() => handleInvite(m)}
                    >
                      <Link2 className="size-3.5" />
                      {invitingId === m.id ? "Creating..." : "Invite"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${m.name}`}
                    disabled={busyId === m.id || linked}
                    onClick={() => handleRemove(m)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
