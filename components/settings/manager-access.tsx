"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type ManagedLogin,
  type ManagerAccessData,
  type ManagerRoleValue,
  setMemberRole,
} from "@/app/actions/manager-access"

const ROLE_LABEL: Record<ManagerRoleValue, string> = {
  none: "Staff",
  manager: "Manager",
  area_manager: "Area manager",
}

export function ManagerAccessSettings({ data }: { data: ManagerAccessData }) {
  const { venues, logins } = data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <CardTitle>Manager access</CardTitle>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Give team members a manager role so they can open the workspace Calendar. Managers see
          their own venue; area managers see the venues you assign below.
        </p>
      </CardHeader>
      <CardContent>
        {logins.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No team members have accepted a login invite yet. Once they join, you can promote them to
            manager or area manager here.
          </p>
        ) : (
          <ul className="grid gap-3">
            {logins.map((login) => (
              <ManagerRow key={login.userId} login={login} venues={venues} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ManagerRow({
  login,
  venues,
}: {
  login: ManagedLogin
  venues: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [role, setRole] = useState<ManagerRoleValue>(login.managerRole)
  const [venueIds, setVenueIds] = useState<Set<number>>(new Set(login.venueIds))
  const [error, setError] = useState<string | null>(null)

  function persist(nextRole: ManagerRoleValue, nextVenues: Set<number>) {
    setError(null)
    startTransition(async () => {
      try {
        await setMemberRole({
          memberUserId: login.userId,
          managerRole: nextRole,
          venueIds: Array.from(nextVenues),
        })
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update access.")
      }
    })
  }

  function changeRole(next: ManagerRoleValue) {
    setRole(next)
    // Manager/none don't use explicit venue lists.
    const nextVenues = next === "area_manager" ? venueIds : new Set<number>()
    if (next !== "area_manager") setVenueIds(nextVenues)
    persist(next, nextVenues)
  }

  function toggleVenue(id: number) {
    const next = new Set(venueIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setVenueIds(next)
    persist(role, next)
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-foreground">{login.name}</p>
            {role !== "none" && (
              <Badge variant="outline" className="border-transparent bg-primary/10 text-xs text-primary">
                {ROLE_LABEL[role]}
              </Badge>
            )}
            {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="truncate text-sm text-muted-foreground">{login.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`role-${login.userId}`} className="sr-only">
            Role for {login.name}
          </Label>
          <Select value={role} onValueChange={(v) => v && changeRole(v as ManagerRoleValue)} disabled={pending}>
            <SelectTrigger id={`role-${login.userId}`} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Staff</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="area_manager">Area manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {role === "area_manager" && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5" /> Venues this area manager can see
          </p>
          {venues.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add venues first.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {venues.map((v) => (
                <label
                  key={v.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={venueIds.has(v.id)}
                    onCheckedChange={() => toggleVenue(v.id)}
                    disabled={pending}
                  />
                  <span className="truncate">{v.name}</span>
                </label>
              ))}
            </div>
          )}
          {venueIds.size === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Select at least one venue, or this area manager won&apos;t see any locations.
            </p>
          )}
        </div>
      )}

      {role === "manager" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Managers see the calendar for their assigned venue only.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </li>
  )
}
