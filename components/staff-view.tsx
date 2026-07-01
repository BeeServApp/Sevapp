"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  Users,
  Clock,
  CalendarOff,
  DollarSign,
  MapPin,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createStaffMember,
  updateLeaveStatus,
  clockIn,
  clockOut,
  createLeaveRequest,
  deleteStaffMember,
} from "@/app/actions/staff"
import { createStaffInvite, revokeStaffInvite } from "@/app/actions/invites"
import { resolveSwap } from "@/app/actions/scheduling"
import { RotaBoard } from "@/components/staff/rota-board"
import type { ScheduledPublishInfo } from "@/app/actions/scheduled-publish"
import { AvailabilityTab } from "@/components/staff/availability-tab"
import { HrTab } from "@/components/staff/hr-tab"
import { TimecardsTab } from "@/components/staff/timecards-tab"
import { ReportsTab } from "@/components/staff/reports-tab"
import { TipsTab } from "@/components/staff/tips-tab"
import type {
  DbStaffMember,
  DbLeaveRequest,
  DbRotaShift,
  DbClockEvent,
  DbAvailability,
  DbShiftSwap,
  DbTimecard,
  DbTipEntry,
  DbSchedulingSettings,
  DbShiftPattern,
  DbShiftTask,
  DbRotaTemplate,
  DbOnboarding,
  DbHrDocument,
} from "@/lib/db/schema"
import { cn } from "@/lib/utils"
import { Copy, Check, Link2, ArrowLeftRight } from "lucide-react"

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  venueId: number
  initialStaff: DbStaffMember[]
  initialLeave: DbLeaveRequest[]
  initialShifts: DbRotaShift[]
  initialClockEvents: DbClockEvent[]
  initialInviteStatuses: Record<number, { status: string; token: string }>
  initialAvailability: DbAvailability[]
  initialSwaps: DbShiftSwap[]
  initialTimecards: DbTimecard[]
  initialTips: DbTipEntry[]
  settings: DbSchedulingSettings
  weekSales: Record<string, number>
  initialPatterns: DbShiftPattern[]
  initialTemplates: (DbRotaTemplate & { shiftCount: number })[]
  initialShiftTasks: DbShiftTask[]
  initialConflicts: Record<number, string>
  initialScheduledPublish: ScheduledPublishInfo | null
  initialOnboarding: DbOnboarding[]
  initialHrDocuments: DbHrDocument[]
  weekStart: string
  rotaDays: string[]
}

// ── Component ────────────────────────────────────────────────────────────────

export function StaffView({
  venueId,
  initialStaff,
  initialLeave,
  initialShifts,
  initialClockEvents,
  initialInviteStatuses,
  initialAvailability,
  initialSwaps,
  initialTimecards,
  initialTips,
  settings,
  weekSales,
  initialPatterns,
  initialTemplates,
  initialShiftTasks,
  initialConflicts,
  initialScheduledPublish,
  initialOnboarding,
  initialHrDocuments,
  weekStart,
  rotaDays,
}: Props) {
  const [staff, setStaff] = useState<DbStaffMember[]>(initialStaff)
  const [leaveReqs, setLeaveReqs] = useState<DbLeaveRequest[]>(initialLeave)
  const [shifts, setShifts] = useState<DbRotaShift[]>(initialShifts)
  // Re-sync from the server whenever a router.refresh() delivers fresh shifts
  // (bulk add, auto-fill, clear week, recurring pattern generation, week nav).
  useEffect(() => {
    setShifts(initialShifts)
  }, [initialShifts])
  const [clockEvents, setClockEvents] = useState<DbClockEvent[]>(initialClockEvents)
  const [swaps, setSwaps] = useState<DbShiftSwap[]>(initialSwaps)
  const [inviteStatuses, setInviteStatuses] =
    useState<Record<number, { status: string; token: string }>>(initialInviteStatuses)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [invitingId, setInvitingId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const staffNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of staff) m.set(s.id, s.name)
    return m
  }, [staff])

  const pendingSwaps = swaps.filter((s) => s.status === "pending")

  async function handleResolveSwap(swapId: number, decision: "approved" | "declined") {
    setSwaps((prev) => prev.map((s) => (s.id === swapId ? { ...s, status: decision } : s)))
    await resolveSwap(swapId, decision)
  }

  function inviteUrl(token: string) {
    if (typeof window === "undefined") return `/join/${token}`
    return `${window.location.origin}/join/${token}`
  }

  async function handleInvite(member: DbStaffMember) {
    setInvitingId(member.id)
    try {
      const inv = await createStaffInvite(member.id, member.email ?? undefined)
      setInviteStatuses((prev) => ({ ...prev, [member.id]: { status: "pending", token: inv.token } }))
      const url = inviteUrl(inv.token)
      try {
        await navigator.clipboard.writeText(url)
        setCopiedId(member.id)
        setTimeout(() => setCopiedId((c) => (c === member.id ? null : c)), 2000)
      } catch {
        /* clipboard may be blocked; link is still shown */
      }
    } finally {
      setInvitingId(null)
    }
  }

  async function handleCopyInvite(member: DbStaffMember, token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setCopiedId(member.id)
      setTimeout(() => setCopiedId((c) => (c === member.id ? null : c)), 2000)
    } catch {
      /* ignore */
    }
  }

  async function handleRevoke(member: DbStaffMember) {
    await revokeStaffInvite(member.id)
    setInviteStatuses((prev) => {
      const next = { ...prev }
      delete next[member.id]
      return next
    })
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const onShift = useMemo(() => staff.filter((s) => s.status === "On shift").length, [staff])
  const onLeave = useMemo(() => staff.filter((s) => s.status === "On leave").length, [staff])
  const totalHours = useMemo(() => staff.reduce((sum, s) => sum + s.hoursWk, 0), [staff])
  const pendingLeave = useMemo(() => leaveReqs.filter((l) => l.status === "Pending").length, [leaveReqs])

  // ── Add staff dialog ──────────────────────────────────────────────────────
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "Staff",
    contract: "Full-time",
    hoursWk: "40",
    status: "Off",
    email: "",
    phone: "",
  })
  const [staffError, setStaffError] = useState<string | null>(null)
  const [staffSaving, setStaffSaving] = useState(false)

  async function handleAddStaff() {
    if (!staffForm.name.trim()) return setStaffError("Name is required.")
    const hrs = Number.parseInt(staffForm.hoursWk, 10)
    if (Number.isNaN(hrs) || hrs < 0) return setStaffError("Enter valid hours.")
    setStaffError(null)
    setStaffSaving(true)
    try {
      const created = await createStaffMember({
        venueId,
        name: staffForm.name.trim(),
        role: staffForm.role,
        contract: staffForm.contract,
        hoursWk: hrs,
        status: staffForm.status,
        email: staffForm.email.trim() || undefined,
        phone: staffForm.phone.trim() || undefined,
      })
      setStaff((prev) => [...prev, created])
      setAddStaffOpen(false)
      setStaffForm({ name: "", role: "Staff", contract: "Full-time", hoursWk: "40", status: "Off", email: "", phone: "" })
    } catch {
      setStaffError("Failed to add staff member.")
    } finally {
      setStaffSaving(false)
    }
  }

  // ── Add leave request dialog ──────────────────────────────────────────────
  const [addLeaveOpen, setAddLeaveOpen] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    staffMemberId: "",
    type: "Annual",
    dates: "",
    days: "1",
  })
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [leaveSaving, setLeaveSaving] = useState(false)

  async function handleAddLeave() {
    if (!leaveForm.staffMemberId) return setLeaveError("Select a staff member.")
    if (!leaveForm.dates.trim()) return setLeaveError("Enter the leave dates.")
    const days = Number.parseInt(leaveForm.days, 10)
    if (Number.isNaN(days) || days < 1) return setLeaveError("Enter valid day count.")
    const member = staff.find((s) => s.id === Number(leaveForm.staffMemberId))
    if (!member) return setLeaveError("Staff member not found.")
    setLeaveError(null)
    setLeaveSaving(true)
    try {
      const created = await createLeaveRequest({
        venueId,
        staffMemberId: member.id,
        name: member.name,
        type: leaveForm.type,
        dates: leaveForm.dates.trim(),
        days,
      })
      setLeaveReqs((prev) => [created, ...prev])
      setAddLeaveOpen(false)
      setLeaveForm({ staffMemberId: "", type: "Annual", dates: "", days: "1" })
    } catch {
      setLeaveError("Failed to submit leave request.")
    } finally {
      setLeaveSaving(false)
    }
  }

  // ── Leave approve / decline ───────────────────────────────────────────────
  function handleLeaveAction(id: number, status: "Approved" | "Declined") {
    startTransition(async () => {
      const updated = await updateLeaveStatus(id, status)
      setLeaveReqs((prev) => prev.map((l) => (l.id === id ? updated : l)))
    })
  }

  // ── GPS Clock In / Out ────────────────────────────────────────────────────
  const [clockOpen, setClockOpen] = useState(false)
  const [clockMemberId, setClockMemberId] = useState("")
  const [clockType, setClockType] = useState<"in" | "out">("in")
  const [gpsStatus, setGpsStatus] = useState<"idle" | "fetching" | "ready" | "denied">("idle")
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [clockError, setClockError] = useState<string | null>(null)
  const [clockSaving, setClockSaving] = useState(false)

  function openClockDialog(type: "in" | "out") {
    setClockType(type)
    setClockOpen(true)
    setClockMemberId("")
    setGpsStatus("idle")
    setGpsCoords(null)
    setClockError(null)
  }

  function requestGps() {
    setGpsStatus("fetching")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsStatus("ready")
      },
      () => {
        setGpsStatus("denied")
        setGpsCoords(null)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleClock() {
    if (!clockMemberId) return setClockError("Select a staff member.")
    const member = staff.find((s) => s.id === Number(clockMemberId))
    if (!member) return setClockError("Staff member not found.")
    setClockError(null)
    setClockSaving(true)

    let locationLabel: string | null = null
    if (gpsCoords) {
      locationLabel = `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`
    }

    try {
      const payload = {
        venueId,
        staffMemberId: member.id,
        staffName: member.name,
        lat: gpsCoords?.lat ?? null,
        lng: gpsCoords?.lng ?? null,
        locationLabel,
      }
      const evt = clockType === "in" ? await clockIn(payload) : await clockOut(payload)
      setClockEvents((prev) => [evt, ...prev])
      // Update local staff status
      setStaff((prev) =>
        prev.map((s) =>
          s.id === member.id ? { ...s, status: clockType === "in" ? "On shift" : "Off" } : s,
        ),
      )
      setClockOpen(false)
    } catch {
      setClockError("Failed to record clock event.")
    } finally {
      setClockSaving(false)
    }
  }

  // Delete staff
  async function handleDeleteStaff(id: number) {
    if (!confirm("Remove this staff member?")) return
    await deleteStaffMember(id)
    setStaff((prev) => prev.filter((s) => s.id !== id))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="HR"
        description="Onboarding, rotas, annual leave, documents, GPS clock-in and team management."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openClockDialog("out")}>
              <LogOut className="size-4" /> Clock Out
            </Button>
            <Button onClick={() => openClockDialog("in")}>
              <LogIn className="size-4" /> Clock In
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs defaultValue="rota">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max">
          <TabsTrigger value="rota">Rota</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="swaps">
            Swaps
            {pendingSwaps.length > 0 && (
              <Badge variant="outline" className="ml-1 border-transparent bg-chart-4/20 text-chart-4">
                {pendingSwaps.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="timecards">Timecards</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="tips">Tips</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="clockin">Clock-in log</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Rota ── */}
        <TabsContent value="rota" className="mt-4 flex flex-col gap-6">
            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard kpi={{ label: "Team members", value: String(staff.length), delta: `${onShift} on shift`, trend: "flat", hint: "active roster" }} />
              <StatCard kpi={{ label: "Scheduled hours", value: `${totalHours}h`, delta: "this week", trend: "flat", hint: "across team" }} />
              <StatCard kpi={{ label: "On leave", value: String(onLeave), delta: `${pendingLeave} pending`, trend: "flat", hint: "requests" }} />
              <StatCard kpi={{ label: "Labour cost", value: "29.1%", delta: "-0.6pt", trend: "down", hint: "of revenue" }} />
            </div>

            {/* Live status panel */}
            {staff.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Live shift status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {staff.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                          s.status === "On shift"
                            ? "border-chart-2/30 bg-chart-2/10"
                            : s.status === "On leave"
                              ? "border-chart-4/30 bg-chart-4/10"
                              : "border-border bg-muted/40",
                        )}
                      >
                        <Avatar className="size-6">
                          <AvatarFallback className="text-xs">{initials(s.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">{s.name}</span>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <RotaBoard
              venueId={venueId}
              weekStart={weekStart}
              rotaDays={rotaDays}
              staff={staff}
              shifts={shifts}
              availability={initialAvailability}
              settings={settings}
              patterns={initialPatterns}
              templates={initialTemplates}
              shiftTasks={initialShiftTasks}
              conflicts={initialConflicts}
              scheduledPublish={initialScheduledPublish}
              onShiftsChange={setShifts}
            />
        </TabsContent>

        {/* ── Onboarding & HR ── */}
        <TabsContent value="onboarding" className="mt-4">
          <HrTab
            venueId={venueId}
            staff={staff}
            initialOnboarding={initialOnboarding}
            initialDocuments={initialHrDocuments}
          />
        </TabsContent>

        {/* ── Availability ── */}
        <TabsContent value="availability" className="mt-4">
          <AvailabilityTab
            venueId={venueId}
            rotaDays={rotaDays}
            staff={staff}
            initialAvailability={initialAvailability}
          />
        </TabsContent>

        {/* ── Swaps & drops ── */}
        <TabsContent value="swaps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Shift swaps &amp; drops</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {swaps.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No swap or drop requests. Staff can request these from their app.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested by</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cover</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {swaps.map((sw) => (
                      <TableRow key={sw.id}>
                        <TableCell className="font-medium">
                          {staffNameById.get(sw.requesterStaffId) ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 capitalize">
                            <ArrowLeftRight className="size-3" />
                            {sw.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sw.targetStaffId ? staffNameById.get(sw.targetStaffId) ?? "—" : "Open pool"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {sw.note || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium capitalize",
                              sw.status === "approved"
                                ? "border-transparent bg-chart-2/15 text-chart-2"
                                : sw.status === "declined"
                                  ? "border-transparent bg-destructive/12 text-destructive"
                                  : sw.status === "pending"
                                    ? "border-transparent bg-chart-4/20 text-[oklch(0.45_0.11_70)]"
                                    : "border-transparent bg-muted text-muted-foreground",
                            )}
                          >
                            {sw.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {sw.status === "pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                onClick={() => handleResolveSwap(sw.id, "approved")}
                              >
                                <CheckCircle2 className="size-3.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleResolveSwap(sw.id, "declined")}
                              >
                                <XCircle className="size-3.5" /> Decline
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground capitalize">{sw.status}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timecards ── */}
        <TabsContent value="timecards" className="mt-4">
          <TimecardsTab
            venueId={venueId}
            weekStart={weekStart}
            staff={staff}
            initialTimecards={initialTimecards}
          />
        </TabsContent>

        {/* ── Reports ── */}
        <TabsContent value="reports" className="mt-4">
          <ReportsTab
            weekStart={weekStart}
            rotaDays={rotaDays}
            staff={staff}
            shifts={shifts}
            weekSales={weekSales}
          />
        </TabsContent>

        {/* ── Tips & commission ── */}
        <TabsContent value="tips" className="mt-4">
          <TipsTab
            venueId={venueId}
            weekStart={weekStart}
            staff={staff}
            shifts={shifts}
            initialTips={initialTips}
          />
        </TabsContent>

        {/* ── Team ── */}
        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Team directory</CardTitle>
              <Button size="sm" onClick={() => setAddStaffOpen(true)}>
                <Plus className="size-4" /> Add staff
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              {staff.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No staff yet. Add your first team member above.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Hours/wk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>App access</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((s) => {
                      const invite = inviteStatuses[s.id]
                      const linked = !!s.linkedUserId
                      return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">{initials(s.name)}</AvatarFallback>
                            </Avatar>
                            <div className="leading-tight">
                              <div className="font-medium">{s.name}</div>
                              {s.email ? (
                                <div className="text-xs text-muted-foreground">{s.email}</div>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.role}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.hoursWk}h</TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell>
                          {linked ? (
                            <Badge variant="outline" className="border-transparent bg-chart-2/15 text-chart-2">
                              <Check className="size-3" /> Linked
                            </Badge>
                          ) : invite?.status === "pending" ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => handleCopyInvite(s, invite.token)}
                              >
                                {copiedId === s.id ? (
                                  <><Check className="size-3.5" /> Copied</>
                                ) : (
                                  <><Copy className="size-3.5" /> Copy link</>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRevoke(s)}
                              >
                                Revoke
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              disabled={invitingId === s.id}
                              onClick={() => handleInvite(s)}
                            >
                              <Link2 className="size-3.5" />
                              {invitingId === s.id ? "Creating..." : "Invite"}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteStaff(s.id)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Leave ── */}
        <TabsContent value="leave" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Leave requests</CardTitle>
              <Button size="sm" onClick={() => setAddLeaveOpen(true)} disabled={staff.length === 0}>
                <Plus className="size-4" /> Request leave
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              {leaveReqs.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No leave requests yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveReqs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{l.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{l.dates}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.days}</TableCell>
                        <TableCell>
                          <StatusBadge status={l.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {l.status === "Pending" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleLeaveAction(l.id, "Declined")}
                              >
                                <XCircle className="size-3.5" /> Decline
                              </Button>
                              <Button
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleLeaveAction(l.id, "Approved")}
                              >
                                <CheckCircle2 className="size-3.5" /> Approve
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─��� Clock-in log ── */}
        <TabsContent value="clockin" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Clock-in history</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Last 100 clock events with GPS coordinates.
              </p>
            </CardHeader>
            <CardContent className="px-0">
              {clockEvents.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No clock events yet. Use the Clock In / Clock Out buttons to record shifts.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clockEvents.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.staffName}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              e.type === "in"
                                ? "border-transparent bg-chart-2/15 text-chart-2"
                                : "border-transparent bg-muted text-muted-foreground",
                            )}
                          >
                            {e.type === "in" ? (
                              <><LogIn className="size-3" /> Clock in</>
                            ) : (
                              <><LogOut className="size-3" /> Clock out</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {fmtDateTime(e.createdAt)}
                        </TableCell>
                        <TableCell>
                          {e.locationLabel ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              {e.locationLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">No GPS</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add staff dialog ── */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>Add a new team member to the venue roster.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="s-name">Full name</Label>
              <Input
                id="s-name"
                value={staffForm.name}
                onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. James Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s-role">Role</Label>
                <Input
                  id="s-role"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Bar Staff"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-contract">Contract</Label>
                <Select
                  value={staffForm.contract}
                  onValueChange={(v) => setStaffForm((f) => ({ ...f, contract: v ?? f.contract }))}
                >
                  <SelectTrigger id="s-contract">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Full-time", "Part-time", "Zero hours", "Casual"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s-hours">Hours/wk</Label>
                <Input
                  id="s-hours"
                  type="number"
                  min="0"
                  value={staffForm.hoursWk}
                  onChange={(e) => setStaffForm((f) => ({ ...f, hoursWk: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-status">Status</Label>
                <Select
                  value={staffForm.status}
                  onValueChange={(v) => setStaffForm((f) => ({ ...f, status: v ?? f.status }))}
                >
                  <SelectTrigger id="s-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Off", "On shift", "On leave"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s-email">Email</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="for app invite & alerts"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-phone">Phone</Label>
                <Input
                  id="s-phone"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Add an email so you can invite this person to the staff app and email them their shifts.
            </p>
            {staffError && <p className="text-sm text-destructive">{staffError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStaffOpen(false)} disabled={staffSaving}>Cancel</Button>
            <Button onClick={handleAddStaff} disabled={staffSaving}>
              {staffSaving ? "Saving..." : "Add staff member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add leave dialog ── */}
      <Dialog open={addLeaveOpen} onOpenChange={setAddLeaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>Submit a new leave request for a staff member.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="l-member">Staff member</Label>
              <Select
                value={leaveForm.staffMemberId}
                onValueChange={(v) => setLeaveForm((f) => ({ ...f, staffMemberId: v ?? f.staffMemberId }))}
              >
                <SelectTrigger id="l-member">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="l-type">Leave type</Label>
                <Select
                  value={leaveForm.type}
                  onValueChange={(v) => setLeaveForm((f) => ({ ...f, type: v ?? f.type }))}
                >
                  <SelectTrigger id="l-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Annual", "Sick", "Unpaid", "Compassionate"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="l-days">Days</Label>
                <Input
                  id="l-days"
                  type="number"
                  min="1"
                  value={leaveForm.days}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, days: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="l-dates">Dates</Label>
              <Input
                id="l-dates"
                value={leaveForm.dates}
                onChange={(e) => setLeaveForm((f) => ({ ...f, dates: e.target.value }))}
                placeholder="e.g. 21–25 Jul 2025"
              />
            </div>
            {leaveError && <p className="text-sm text-destructive">{leaveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLeaveOpen(false)} disabled={leaveSaving}>Cancel</Button>
            <Button onClick={handleAddLeave} disabled={leaveSaving}>
              {leaveSaving ? "Submitting..." : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GPS Clock dialog ── */}
      <Dialog open={clockOpen} onOpenChange={setClockOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {clockType === "in" ? "Clock In" : "Clock Out"}
            </DialogTitle>
            <DialogDescription>
              Select the staff member and optionally capture GPS location.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="c-member">Staff member</Label>
              <Select value={clockMemberId} onValueChange={(v) => setClockMemberId(v ?? "")}>
                <SelectTrigger id="c-member">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — <span className="text-muted-foreground">{s.status}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GPS capture */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">GPS Location</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestGps}
                  disabled={gpsStatus === "fetching" || gpsStatus === "ready"}
                >
                  {gpsStatus === "fetching" ? "Locating..." : gpsStatus === "ready" ? "Captured" : "Capture GPS"}
                </Button>
              </div>
              {gpsStatus === "ready" && gpsCoords && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                </p>
              )}
              {gpsStatus === "denied" && (
                <p className="mt-2 text-xs text-destructive">
                  Location access denied. Clock event will be recorded without GPS.
                </p>
              )}
              {gpsStatus === "idle" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  GPS is optional. Click "Capture GPS" to record location.
                </p>
              )}
            </div>

            {clockError && <p className="text-sm text-destructive">{clockError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockOpen(false)} disabled={clockSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleClock}
              disabled={clockSaving || !clockMemberId}
              className={clockType === "out" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {clockSaving
                ? "Recording..."
                : clockType === "in"
                  ? "Confirm Clock In"
                  : "Confirm Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
