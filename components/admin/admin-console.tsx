"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Ban,
  Banknote,
  Building2,
  KeyRound,
  Loader2,
  Power,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react"
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
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  adminDeactivateAccount,
  adminDeleteAccount,
  adminReactivateAccount,
  adminSetPassword,
  adminUpdateAccount,
  adminUpdateSubscription,
  adminUpdateVenue,
  getAccountDetail,
  type AdminAccount,
  type AdminAccountDetail,
  type AdminMetrics,
  type AdminVenue,
} from "@/app/actions/admin"
import { formatGBP, PRICING_TIERS } from "@/lib/pricing"

const VENUE_TYPES = ["Pub", "Bar", "Restaurant", "Hotel", "Cafe", "Nightclub", "Brewery"]
const VENUE_STATUSES = ["Active", "Pre-opening", "Temporarily closed", "Closed"]
const SUB_STATUSES = ["none", "trialing", "active", "past_due", "canceled"]

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

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Banknote
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}

export function AdminConsole({
  accounts,
  metrics,
}: {
  accounts: AdminAccount[]
  metrics: AdminMetrics
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [done, setDone] = useState<string | null>(null)

  // Manage-customer dialog state.
  const [manageId, setManageId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminAccountDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const filtered = accounts.filter((a) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
  })

  async function openManage(account: AdminAccount) {
    setManageId(account.id)
    setDetail(null)
    setLoadingDetail(true)
    try {
      const d = await getAccountDetail(account.id)
      setDetail(d)
    } catch {
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  function flash(message: string) {
    setDone(message)
    setTimeout(() => setDone(null), 4000)
  }

  return (
    <div className="space-y-6">
      {done && (
        <div
          className="rounded-md border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {done}
        </div>
      )}

      {/* Revenue overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Monthly recurring revenue"
          value={formatGBP(metrics.mrrPence)}
          hint={`${metrics.activeSubscriptions} active ${
            metrics.activeSubscriptions === 1 ? "subscription" : "subscriptions"
          }`}
          icon={Banknote}
        />
        <MetricCard
          label="Trial pipeline"
          value={formatGBP(metrics.trialPipelinePence)}
          hint={`${metrics.trialingCount} on trial`}
          icon={Loader2}
        />
        <MetricCard
          label="Customers"
          value={String(metrics.totalCustomers)}
          hint={`${metrics.totalStaffAccounts} staff logins`}
          icon={Users}
        />
        <MetricCard
          label="Venues"
          value={String(metrics.totalVenues)}
          hint="Across all customers"
          icon={Building2}
        />
      </div>

      {metrics.planBreakdown.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-medium text-foreground">Revenue by plan</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {metrics.planBreakdown.map((p) => (
              <div key={p.plan} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium capitalize text-foreground">{p.plan}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{formatGBP(p.mrrPence)}</p>
                <p className="text-xs text-muted-foreground">
                  {p.customers} {p.customers === 1 ? "customer" : "customers"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customer database */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">Customer database</h2>
          <div className="relative max-w-sm sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Venues</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id} className={a.disabledAt ? "opacity-60" : undefined}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{a.name}</span>
                        {a.disabledAt && (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="size-3" />
                            Deactivated
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.email}</TableCell>
                    <TableCell>
                      <Badge variant={a.appRole === "owner" ? "default" : "secondary"}>
                        {a.appRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.appRole === "owner" ? a.venueCount : "—"}
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
                    <TableCell className="text-right text-foreground">
                      {a.appRole === "owner" && a.mrrPence > 0 ? formatGBP(a.mrrPence) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openManage(a)}>
                        <Settings2 className="size-4" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ManageDialog
        open={manageId !== null}
        loading={loadingDetail}
        detail={detail}
        onClose={() => {
          setManageId(null)
          setDetail(null)
        }}
        onSaved={(message, updated) => {
          if (updated) setDetail(updated)
          flash(message)
        }}
        onChanged={(message, closeDialog) => {
          flash(message)
          router.refresh()
          if (closeDialog) {
            setManageId(null)
            setDetail(null)
          }
        }}
      />
    </div>
  )
}

function ManageDialog({
  open,
  loading,
  detail,
  onClose,
  onSaved,
  onChanged,
}: {
  open: boolean
  loading: boolean
  detail: AdminAccountDetail | null
  onClose: () => void
  onSaved: (message: string, updated?: AdminAccountDetail) => void
  onChanged: (message: string, closeDialog?: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail ? `Manage ${detail.name}` : "Manage customer"}</DialogTitle>
          <DialogDescription>
            {detail
              ? `Edit this customer's account, subscription and venues.`
              : "Loading customer details…"}
          </DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="account" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="venues">Venues ({detail.venues.length})</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="danger">Danger</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="pt-4">
              <AccountForm detail={detail} onSaved={onSaved} />
            </TabsContent>

            <TabsContent value="venues" className="pt-4">
              <VenuesPanel detail={detail} onSaved={onSaved} />
            </TabsContent>

            <TabsContent value="security" className="pt-4">
              <PasswordForm detail={detail} onSaved={onSaved} />
            </TabsContent>

            <TabsContent value="danger" className="pt-4">
              <DangerPanel detail={detail} onChanged={onChanged} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AccountForm({
  detail,
  onSaved,
}: {
  detail: AdminAccountDetail
  onSaved: (message: string, updated?: AdminAccountDetail) => void
}) {
  const [name, setName] = useState(detail.name)
  const [email, setEmail] = useState(detail.email)
  const [plan, setPlan] = useState(detail.subscriptionPlan ?? "none")
  const [status, setStatus] = useState(detail.subscriptionStatus ?? "none")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        const profile = new FormData()
        profile.set("userId", detail.id)
        profile.set("name", name)
        profile.set("email", email)
        await adminUpdateAccount(profile)

        if (detail.appRole === "owner") {
          const sub = new FormData()
          sub.set("userId", detail.id)
          sub.set("plan", plan === "none" ? "" : plan)
          sub.set("status", status)
          await adminUpdateSubscription(sub)
        }

        onSaved(`Account updated for ${email}.`, {
          ...detail,
          name,
          email,
          subscriptionPlan: plan === "none" ? null : plan,
          subscriptionStatus: status,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update account.")
      }
    })
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="acc-name">Name</Label>
        <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="acc-email">Email</Label>
        <Input
          id="acc-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
      </div>

      {detail.appRole === "owner" && (
        <>
          <Separator />
          <p className="text-sm font-medium text-foreground">Subscription</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v ?? "none")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No plan</SelectItem>
                  {PRICING_TIERS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({formatGBP(t.pricePerLocationPence)}/venue)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "none")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {SUB_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Changing plan or status here overrides billing state. Use with care — Stripe events may
            reset it on the next sync.
          </p>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </div>
  )
}

function VenuesPanel({
  detail,
  onSaved,
}: {
  detail: AdminAccountDetail
  onSaved: (message: string, updated?: AdminAccountDetail) => void
}) {
  const [editing, setEditing] = useState<AdminVenue | null>(null)

  if (detail.venues.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">This customer has no venues.</p>
  }

  return (
    <div className="space-y-3">
      {detail.venues.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{v.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {v.type}
              {v.city ? ` · ${v.city}` : ""}
              {v.managerName ? ` · ${v.managerName}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={v.status === "Active" ? "default" : "outline"}>{v.status}</Badge>
            <Button variant="outline" size="sm" onClick={() => setEditing(v)}>
              Edit
            </Button>
          </div>
        </div>
      ))}

      <VenueEditDialog
        userId={detail.id}
        venue={editing}
        onClose={() => setEditing(null)}
        onSaved={(message, updatedVenue) => {
          setEditing(null)
          onSaved(message, {
            ...detail,
            venues: detail.venues.map((x) => (x.id === updatedVenue.id ? updatedVenue : x)),
          })
        }}
      />
    </div>
  )
}

function VenueEditDialog({
  userId,
  venue,
  onClose,
  onSaved,
}: {
  userId: string
  venue: AdminVenue | null
  onClose: () => void
  onSaved: (message: string, updatedVenue: AdminVenue) => void
}) {
  const [form, setForm] = useState<AdminVenue | null>(venue)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Keep local form in sync when a different venue is opened.
  if (venue && (!form || form.id !== venue.id)) {
    setForm(venue)
  }

  function set<K extends keyof AdminVenue>(key: K, value: AdminVenue[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function save() {
    if (!form) return
    setError(null)
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set("userId", userId)
        fd.set("venueId", String(form.id))
        fd.set("name", form.name)
        fd.set("type", form.type)
        fd.set("status", form.status)
        fd.set("address", form.address ?? "")
        fd.set("city", form.city ?? "")
        fd.set("postcode", form.postcode ?? "")
        fd.set("phone", form.phone ?? "")
        fd.set("email", form.email ?? "")
        fd.set("managerName", form.managerName ?? "")
        await adminUpdateVenue(fd)
        onSaved(`Venue "${form.name}" updated.`, form)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update venue.")
      }
    })
  }

  return (
    <Dialog open={venue !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit venue</DialogTitle>
          <DialogDescription>Update this venue on behalf of the customer.</DialogDescription>
        </DialogHeader>

        {form && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="v-name">Name</Label>
              <Input id="v-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v ?? form.type)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v ?? form.status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v-address">Address</Label>
              <Input
                id="v-address"
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="v-city">City</Label>
                <Input
                  id="v-city"
                  value={form.city ?? ""}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="v-postcode">Postcode</Label>
                <Input
                  id="v-postcode"
                  value={form.postcode ?? ""}
                  onChange={(e) => set("postcode", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="v-phone">Phone</Label>
                <Input
                  id="v-phone"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="v-email">Email</Label>
                <Input
                  id="v-email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v-manager">Manager</Label>
              <Input
                id="v-manager"
                value={form.managerName ?? ""}
                onChange={(e) => set("managerName", e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save venue"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PasswordForm({
  detail,
  onSaved,
}: {
  detail: AdminAccountDetail
  onSaved: (message: string) => void
}) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    const fd = new FormData()
    fd.set("userId", detail.id)
    fd.set("newPassword", password)
    startTransition(async () => {
      try {
        await adminSetPassword(fd)
        setPassword("")
        setConfirm("")
        onSaved(`Password updated for ${detail.email}. They have been signed out.`)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update password.")
      }
    })
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Set a new password for {detail.name}. They will be signed out of all sessions.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="pw-new">New password</Label>
        <Input
          id="pw-new"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-confirm">Confirm password</Label>
        <Input
          id="pw-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button onClick={reset} disabled={pending}>
          <KeyRound className="size-4" />
          {pending ? "Updating…" : "Update password"}
        </Button>
      </DialogFooter>
    </div>
  )
}

function DangerPanel({
  detail,
  onChanged,
}: {
  detail: AdminAccountDetail
  onChanged: (message: string, closeDialog?: boolean) => void
}) {
  const isDeactivated = detail.disabledAt !== null
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  function toggleActive() {
    setError(null)
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set("userId", detail.id)
        if (isDeactivated) {
          await adminReactivateAccount(fd)
          onChanged(`${detail.name} has been reactivated.`, true)
        } else {
          await adminDeactivateAccount(fd)
          onChanged(`${detail.name} has been deactivated and signed out.`, true)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update account status.")
      }
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set("userId", detail.id)
        await adminDeleteAccount(fd)
        setConfirmOpen(false)
        onChanged(`${detail.name} and all their data have been permanently deleted.`, true)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete account.")
      }
    })
  }

  return (
    <div className="grid gap-5">
      {/* Deactivate / reactivate */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {isDeactivated ? "Reactivate account" : "Deactivate account"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDeactivated
                ? "Restore access so this member can sign in again. Their data is unchanged."
                : "Immediately sign this member out and block them from signing in. No data is deleted, and you can reactivate them at any time."}
            </p>
          </div>
          <Button variant="outline" onClick={toggleActive} disabled={pending} className="shrink-0">
            <Power className="size-4" />
            {isDeactivated ? "Reactivate" : "Deactivate"}
          </Button>
        </div>
      </div>

      {/* Permanent delete */}
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <ShieldAlert className="size-4 text-destructive" />
              Remove account
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete {detail.name} and{" "}
              <span className="font-medium text-foreground">all of their data</span>
              {detail.appRole === "owner"
                ? " — every venue, staff record, schedule, compliance log and billing state."
                : "."}{" "}
              This cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              setConfirmText("")
              setError(null)
              setConfirmOpen(true)
            }}
            disabled={pending}
            className="shrink-0"
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={confirmOpen} onOpenChange={(o) => !pending && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {detail.name}?</DialogTitle>
            <DialogDescription>
              This deletes the account and every record tied to it. This action is irreversible. Type{" "}
              <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            aria-label="Type DELETE to confirm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={pending || confirmText !== "DELETE"}
            >
              <Trash2 className="size-4" />
              {pending ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
