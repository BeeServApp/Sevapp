"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { addMember, removeMember, updateMember } from "@/app/actions/members"

export interface TeamMember {
  id: number
  name: string
  email: string
  role: string
  status: string
}

const roles = ["Owner", "Manager", "Supervisor", "Bar Staff", "Kitchen", "Staff"]

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
      await addMember({ venueId, name, email, role })
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
            <Plus className="size-4" /> Invite member
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>Add a member to this venue&apos;s team.</DialogDescription>
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
              {saving ? "Adding..." : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamSettings({
  members,
  venueId,
  venueName,
}: {
  members: TeamMember[]
  venueId: number
  venueName: string
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function handleRole(m: TeamMember, role: string) {
    setBusyId(m.id)
    try {
      await updateMember(m.id, { name: m.name, email: m.email, role, status: m.status })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(id: number) {
    if (!confirm("Remove this team member?")) return
    setBusyId(id)
    try {
      await removeMember(id)
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
            People with access to {venueName}.
          </p>
        </div>
        <AddMemberDialog venueId={venueId} />
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {members.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No team members yet. Invite your first one.
            </li>
          )}
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-4">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-foreground">{m.name}</p>
                  <Badge
                    variant="outline"
                    className={
                      m.status === "Active"
                        ? "border-transparent bg-chart-2/15 text-xs text-chart-2"
                        : "border-transparent bg-chart-4/20 text-xs text-[oklch(0.45_0.11_70)]"
                    }
                  >
                    {m.status}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Select
                  value={m.role}
                  onValueChange={(v) => v && handleRole(m, v)}
                  disabled={busyId === m.id || m.role === "Owner"}
                >
                  <SelectTrigger className="w-36" aria-label={`Role for ${m.name}`}>
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
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${m.name}`}
                  disabled={busyId === m.id || m.role === "Owner"}
                  onClick={() => handleRemove(m.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
