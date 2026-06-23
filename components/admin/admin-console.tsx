"use client"

import { useState, useTransition } from "react"
import { KeyRound, Search } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { adminSetPassword, type AdminAccount } from "@/app/actions/admin"

function statusVariant(status: string | null): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default"
    case "trialing":
      return "secondary"
    case "past_due":
      return "destructive"
    default:
      return "outline"
  }
}

export function AdminConsole({ accounts }: { accounts: AdminAccount[] }) {
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState<AdminAccount | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const filtered = accounts.filter((a) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
  })

  function openReset(account: AdminAccount) {
    setTarget(account)
    setPassword("")
    setConfirm("")
    setError(null)
  }

  function handleReset() {
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    if (!target) return
    const fd = new FormData()
    fd.set("userId", target.id)
    fd.set("newPassword", password)
    startTransition(async () => {
      try {
        await adminSetPassword(fd)
        setDone(`Password updated for ${target.email}.`)
        setTarget(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update password.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {done && (
        <div
          className="rounded-md border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {done}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Businesses</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No accounts found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell>
                    <Badge variant={a.appRole === "owner" ? "default" : "secondary"}>
                      {a.appRole}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.appRole === "owner" ? a.businessCount : "—"}
                  </TableCell>
                  <TableCell>
                    {a.appRole === "owner" ? (
                      <Badge variant={statusVariant(a.subscriptionStatus)}>
                        {a.subscriptionStatus ?? "none"}
                        {a.subscriptionPlan ? ` · ${a.subscriptionPlan}` : ""}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openReset(a)}>
                      <KeyRound className="size-4" />
                      Reset password
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {target?.name} ({target?.email}). They will be signed out of all
              sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={pending}>
              {pending ? "Updating..." : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
