"use client"

import { useMemo, useState } from "react"
import { Plus, Download, MoreVertical, Pencil, Trash2, Coins, Link2 } from "lucide-react"
import * as XLSX from "xlsx"
import { StatCard } from "@/components/stat-card"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  createGamingMachine,
  updateGamingMachine,
  deleteGamingMachine,
  createGamingEntry,
  deleteGamingEntry,
} from "@/app/actions/gaming"
import {
  MGD_BANDS,
  MACHINE_TYPES,
  bpsForBand,
  bandLabel,
  defaultBandForType,
  computeSplit,
  sumEntries,
  entriesForMonth,
  type GamingMachineWithEntries,
} from "@/lib/gaming"
import type { DbGamingEntry, DbGamingMachine } from "@/lib/db/schema"

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
})

interface AssetOption {
  id: number
  name: string
}

interface Props {
  venueId: number
  initialMachines: GamingMachineWithEntries[]
  assets: AssetOption[]
}

function poundsToPence(value: string) {
  const n = Number.parseFloat(value)
  return Number.isNaN(n) ? 0 : Math.round(n * 100)
}

function monthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function GamingMachines({ venueId, initialMachines, assets }: Props) {
  const [machines, setMachines] = useState<GamingMachineWithEntries[]>(initialMachines)

  const [machineOpen, setMachineOpen] = useState(false)
  const [editing, setEditing] = useState<DbGamingMachine | null>(null)
  const [logFor, setLogFor] = useState<DbGamingMachine | null>(null)
  const [deletingMachine, setDeletingMachine] = useState<DbGamingMachine | null>(null)

  const assetName = useMemo(() => {
    const map = new Map(assets.map((a) => [a.id, a.name]))
    return (id: number | null) => (id ? map.get(id) ?? null : null)
  }, [assets])

  // --- MTD totals across all machines --------------------------------------
  const mk = monthKey()
  const allEntries = useMemo(() => machines.flatMap((m) => m.entries), [machines])
  const mtd = useMemo(() => sumEntries(entriesForMonth(allEntries, mk)), [allEntries, mk])
  const activeCount = machines.filter((m) => m.active).length

  const kpis = [
    {
      label: "Gaming income (MTD)",
      value: gbp.format(mtd.totalIncomePence / 100),
      delta: `${mtd.entryCount} collection${mtd.entryCount === 1 ? "" : "s"}`,
      trend: "flat" as const,
      hint: "this month",
    },
    {
      label: "MGD due (MTD)",
      value: gbp.format(mtd.mgdPence / 100),
      delta: "Machine Games Duty",
      trend: "down" as const,
      hint: "this month",
    },
    {
      label: "Location share (MTD)",
      value: gbp.format(mtd.locationSharePence / 100),
      delta: "venue keeps",
      trend: "up" as const,
      hint: "after MGD & split",
    },
    {
      label: "Active machines",
      value: String(activeCount),
      delta: machines.length > activeCount ? `${machines.length - activeCount} inactive` : "all live",
      trend: "flat" as const,
      hint: "in register",
    },
  ]

  function handleMachineSaved(saved: DbGamingMachine) {
    setMachines((prev) => {
      const exists = prev.some((m) => m.id === saved.id)
      if (exists) return prev.map((m) => (m.id === saved.id ? { ...saved, entries: m.entries } : m))
      return [...prev, { ...saved, entries: [] }]
    })
  }

  function handleEntrySaved(entry: DbGamingEntry) {
    setMachines((prev) =>
      prev.map((m) => (m.id === entry.machineId ? { ...m, entries: [entry, ...m.entries] } : m)),
    )
  }

  async function handleDeleteMachine() {
    if (!deletingMachine) return
    await deleteGamingMachine(deletingMachine.id)
    setMachines((prev) => prev.filter((m) => m.id !== deletingMachine.id))
    setDeletingMachine(null)
  }

  async function handleDeleteEntry(id: number, machineId: number) {
    await deleteGamingEntry(id)
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId ? { ...m, entries: m.entries.filter((e) => e.id !== id) } : m,
      ),
    )
  }

  function handleExport() {
    const rows = allEntries
      .slice()
      .sort((a, b) => a.collectionDateISO.localeCompare(b.collectionDateISO))
      .map((e) => {
        const machine = machines.find((m) => m.id === e.machineId)
        return {
          Machine: machine?.name ?? "—",
          "Site Code": machine?.siteCode ?? "",
          Type: machine?.machineType ?? "",
          "Collection Date": e.collectionDateISO,
          Days: e.days,
          "Total Income (£)": (e.totalIncomePence / 100).toFixed(2),
          "Refills & Sundries (£)": (e.refillsPence / 100).toFixed(2),
          "Net (£)": (e.netPence / 100).toFixed(2),
          "MGD Rate": `${(e.mgdRateBps / 100).toFixed(0)}%`,
          "MGD (£)": (e.mgdPence / 100).toFixed(2),
          "Location Share (£)": (e.locationSharePence / 100).toFixed(2),
          "Supplier Share (£)": (e.supplierSharePence / 100).toFixed(2),
        }
      })
    const totals = sumEntries(allEntries)
    rows.push({
      Machine: "GRAND TOTAL",
      "Site Code": "",
      Type: "",
      "Collection Date": "",
      Days: allEntries.reduce((s, e) => s + e.days, 0),
      "Total Income (£)": (totals.totalIncomePence / 100).toFixed(2),
      "Refills & Sundries (£)": (totals.refillsPence / 100).toFixed(2),
      "Net (£)": (totals.netPence / 100).toFixed(2),
      "MGD Rate": "",
      "MGD (£)": (totals.mgdPence / 100).toFixed(2),
      "Location Share (£)": (totals.locationSharePence / 100).toFixed(2),
      "Supplier Share (£)": (totals.supplierSharePence / 100).toFixed(2),
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Gaming MGD report")
    XLSX.writeFile(wb, `gaming-mgd-report-${mk}.xlsx`)
  }

  const hasMachines = machines.length > 0
  const hasEntries = allEntries.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gaming machines &amp; MGD</h2>
          <p className="text-sm text-muted-foreground">
            Track machine income, calculate UK Machine Games Duty and split location vs supplier share.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={!hasEntries}>
            <Download className="size-4" /> Export to Excel
          </Button>
          <Button className="gap-1.5" onClick={() => setMachineOpen(true)}>
            <Plus className="size-4" /> Add machine
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Machine register</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            MGD band, revenue split and linked asset for each machine.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          {!hasMachines ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No machines yet. Use &ldquo;Add machine&rdquo; to register your first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>MGD band</TableHead>
                  <TableHead className="text-center">Loc. share</TableHead>
                  <TableHead>Linked asset</TableHead>
                  <TableHead className="text-right">Location share (MTD)</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((m) => {
                  const mtdMachine = sumEntries(entriesForMonth(m.entries, mk))
                  const linked = assetName(m.assetId)
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.siteCode ? `${m.siteCode} · ` : ""}
                          {MACHINE_TYPES.find((t) => t.key === m.machineType)?.label ?? m.machineType}
                          {!m.active && " · inactive"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {bandLabel(m.mgdBand)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        {m.locationSharePct}%
                      </TableCell>
                      <TableCell>
                        {linked ? (
                          <span className="inline-flex items-center gap-1 text-sm text-foreground">
                            <Link2 className="size-3.5 text-muted-foreground" /> {linked}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {gbp.format(mtdMachine.locationSharePence / 100)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setLogFor(m)}>
                            Log
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="size-8 shrink-0">
                                  <MoreVertical className="size-4" />
                                  <span className="sr-only">Machine actions</span>
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing(m)}>
                                <Pencil className="size-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeletingMachine(m)}
                              >
                                <Trash2 className="size-4" /> Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collections &amp; MGD report</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Every recorded collection with calculated net, duty and revenue split.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          {!hasEntries ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No collections recorded. Use &ldquo;Log&rdquo; on a machine to enter revenue.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">MGD</TableHead>
                  <TableHead className="text-right">Location</TableHead>
                  <TableHead className="text-right">Supplier</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEntries
                  .slice()
                  .sort((a, b) => b.collectionDateISO.localeCompare(a.collectionDateISO))
                  .map((e) => {
                    const machine = machines.find((m) => m.id === e.machineId)
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{machine?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.days} day{e.days === 1 ? "" : "s"} · MGD {(e.mgdRateBps / 100).toFixed(0)}%
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{e.collectionDateISO}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {gbp.format(e.totalIncomePence / 100)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {gbp.format(e.netPence / 100)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          {gbp.format(e.mgdPence / 100)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {gbp.format(e.locationSharePence / 100)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {gbp.format(e.supplierSharePence / 100)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteEntry(e.id, e.machineId)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete collection</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                <TableRow className="border-t-2">
                  <TableCell className="font-medium" colSpan={2}>
                    Grand total
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {gbp.format(sumEntries(allEntries).totalIncomePence / 100)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {gbp.format(sumEntries(allEntries).netPence / 100)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-destructive">
                    {gbp.format(sumEntries(allEntries).mgdPence / 100)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {gbp.format(sumEntries(allEntries).locationSharePence / 100)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-muted-foreground">
                    {gbp.format(sumEntries(allEntries).supplierSharePence / 100)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / edit machine dialog */}
      <MachineDialog
        venueId={venueId}
        assets={assets}
        open={machineOpen || !!editing}
        machine={editing}
        onOpenChange={(o) => {
          if (!o) {
            setMachineOpen(false)
            setEditing(null)
          }
        }}
        onSaved={handleMachineSaved}
      />

      {/* Log revenue dialog */}
      {logFor && (
        <LogRevenueDialog
          venueId={venueId}
          machine={logFor}
          open={!!logFor}
          onOpenChange={(o) => !o && setLogFor(null)}
          onSaved={handleEntrySaved}
        />
      )}

      {/* Delete machine confirm */}
      <AlertDialog open={!!deletingMachine} onOpenChange={(o) => !o && setDeletingMachine(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove machine?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes &ldquo;{deletingMachine?.name}&rdquo; and all its recorded collections. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteMachine}>
              Remove machine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Machine dialog ----------------------------------------------------------

function MachineDialog({
  venueId,
  assets,
  open,
  machine,
  onOpenChange,
  onSaved,
}: {
  venueId: number
  assets: AssetOption[]
  open: boolean
  machine: DbGamingMachine | null
  onOpenChange: (open: boolean) => void
  onSaved: (m: DbGamingMachine) => void
}) {
  const isEdit = !!machine
  const [name, setName] = useState("")
  const [siteCode, setSiteCode] = useState("")
  const [machineType, setMachineType] = useState("AWP")
  const [mgdBand, setMgdBand] = useState("Standard")
  const [locationSharePct, setLocationSharePct] = useState("50")
  const [assetId, setAssetId] = useState("none")
  const [active, setActive] = useState("active")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Sync form when the dialog opens for a given machine.
  const [syncedFor, setSyncedFor] = useState<number | "new" | null>(null)
  const targetKey = machine ? machine.id : "new"
  if (open && syncedFor !== targetKey) {
    setName(machine?.name ?? "")
    setSiteCode(machine?.siteCode ?? "")
    setMachineType(machine?.machineType ?? "AWP")
    setMgdBand(machine?.mgdBand ?? "Standard")
    setLocationSharePct(String(machine?.locationSharePct ?? 50))
    setAssetId(machine?.assetId ? String(machine.assetId) : "none")
    setActive(machine?.active === false ? "inactive" : "active")
    setError(null)
    setSyncedFor(targetKey)
  }
  if (!open && syncedFor !== null) setSyncedFor(null)

  function onTypeChange(v: string) {
    setMachineType(v)
    setMgdBand(defaultBandForType(v))
  }

  async function handleSave() {
    if (!name.trim()) return setError("Enter a machine name.")
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name,
        siteCode,
        machineType,
        mgdBand,
        locationSharePct: Number.parseInt(locationSharePct, 10),
        assetId: assetId === "none" ? null : Number.parseInt(assetId, 10),
      }
      const saved = isEdit
        ? await updateGamingMachine(machine!.id, { ...payload, active: active === "active" })
        : await createGamingMachine({ venueId, ...payload })
      onSaved(saved)
      onOpenChange(false)
    } catch {
      setError("Failed to save machine.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit machine" : "Add machine"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this machine's details." : "Register a gaming machine for MGD tracking."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="gm-name">Machine / model</Label>
            <Input
              id="gm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AWP-1 King of Games (DIG) £100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gm-site">Site code</Label>
              <Input
                id="gm-site"
                value={siteCode}
                onChange={(e) => setSiteCode(e.target.value)}
                placeholder="e.g. 13687"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gm-type">Type</Label>
              <Select value={machineType} onValueChange={(v) => onTypeChange(v ?? "AWP")}>
                <SelectTrigger id="gm-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MACHINE_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gm-band">MGD band</Label>
              <Select value={mgdBand} onValueChange={(v) => setMgdBand(v ?? "Standard")}>
                <SelectTrigger id="gm-band">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MGD_BANDS.map((b) => (
                    <SelectItem key={b.key} value={b.key}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gm-share">Location share %</Label>
              <Input
                id="gm-share"
                type="number"
                min="0"
                max="100"
                value={locationSharePct}
                onChange={(e) => setLocationSharePct(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gm-asset">Linked asset (optional)</Label>
            <Select value={assetId} onValueChange={(v) => setAssetId(v ?? "none")}>
              <SelectTrigger id="gm-asset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="grid gap-2">
              <Label htmlFor="gm-active">Status</Label>
              <Select value={active} onValueChange={(v) => setActive(v ?? "active")}>
                <SelectTrigger id="gm-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add machine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Log revenue dialog ------------------------------------------------------

function LogRevenueDialog({
  venueId,
  machine,
  open,
  onOpenChange,
  onSaved,
}: {
  venueId: number
  machine: DbGamingMachine
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (e: DbGamingEntry) => void
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [days, setDays] = useState("14")
  const [income, setIncome] = useState("")
  const [refills, setRefills] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => {
    return computeSplit({
      totalIncomePence: poundsToPence(income),
      refillsPence: poundsToPence(refills),
      mgdRateBps: bpsForBand(machine.mgdBand),
      locationSharePct: machine.locationSharePct,
    })
  }, [income, refills, machine.mgdBand, machine.locationSharePct])

  async function handleSave() {
    const incomePence = poundsToPence(income)
    if (incomePence <= 0) return setError("Enter the total income for this collection.")
    if (!date) return setError("Enter a collection date.")
    setError(null)
    setSaving(true)
    try {
      const created = await createGamingEntry({
        venueId,
        machineId: machine.id,
        collectionDateISO: date,
        days: Number.parseInt(days, 10) || 0,
        totalIncomePence: incomePence,
        refillsPence: poundsToPence(refills),
        notes,
      })
      onSaved(created)
      onOpenChange(false)
    } catch {
      setError("Failed to save collection.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log collection</DialogTitle>
          <DialogDescription>
            {machine.name} · MGD {bandLabel(machine.mgdBand)} · {machine.locationSharePct}% location share
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ge-date">Collection date</Label>
              <Input id="ge-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ge-days">Days</Label>
              <Input
                id="ge-days"
                type="number"
                min="0"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ge-income">Total income (£)</Label>
              <Input
                id="ge-income"
                type="number"
                min="0"
                step="0.01"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ge-refills">Refills &amp; sundries (£)</Label>
              <Input
                id="ge-refills"
                type="number"
                min="0"
                step="0.01"
                value={refills}
                onChange={(e) => setRefills(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Live MGD split preview */}
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Coins className="size-3.5" /> Calculated split
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Net (after refills)</dt>
              <dd className="text-right font-medium tabular-nums">
                {gbp.format(preview.netPence / 100)}
              </dd>
              <dt className="text-muted-foreground">MGD ({(bpsForBand(machine.mgdBand) / 100).toFixed(0)}%)</dt>
              <dd className="text-right font-medium tabular-nums text-destructive">
                {gbp.format(preview.mgdPence / 100)}
              </dd>
              <dt className="text-muted-foreground">Location share</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">
                {gbp.format(preview.locationSharePence / 100)}
              </dd>
              <dt className="text-muted-foreground">Supplier share</dt>
              <dd className="text-right font-medium tabular-nums">
                {gbp.format(preview.supplierSharePence / 100)}
              </dd>
            </dl>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ge-notes">Notes (optional)</Label>
            <Input
              id="ge-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. cashless £73, banked"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
