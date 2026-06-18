"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Download, Plus, MoreVertical, Pencil, Trash2, CheckCircle2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  createCertificate,
  createCheck,
  createDocument,
  deleteCertificate,
  deleteCheck,
  deleteDocument,
  logCheck,
  updateCertificate,
} from "@/app/actions/compliance"
import type { DbCertificate, DbComplianceCheck, DbDocument } from "@/lib/db/schema"
import type { Kpi as KpiType } from "@/lib/mock-data"

const frequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "Annually"]
const checkStatuses = ["Complete", "Due", "Overdue"]
const certStatuses = ["Valid", "Expiring", "Expired"]
const docCategories = ["Health & Safety", "Operations", "HR", "Food Safety", "Licensing", "General"]

function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string
  onEdit?: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <MoreVertical className="size-4" />
            <span className="sr-only">{label}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------ Check dialog ------------------------------ */

function CheckDialog({ venueId }: { venueId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState("Monthly")
  const [owner, setOwner] = useState("")
  const [status, setStatus] = useState("Due")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Check name is required.")
    setSaving(true)
    setError(null)
    try {
      await createCheck({ venueId, name, frequency, owner, status })
      setName("")
      setFrequency("Monthly")
      setOwner("")
      setStatus("Due")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add check.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-1.5">
            <Plus className="size-4" /> Log a check
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add compliance check</DialogTitle>
          <DialogDescription>Create a recurring check for the team to complete.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="chk-name">Check</Label>
            <Input id="chk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fire alarm test" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="chk-freq">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v ?? "Monthly")}>
                <SelectTrigger id="chk-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chk-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "Due")}>
                <SelectTrigger id="chk-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {checkStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="chk-owner">Owner</Label>
            <Input id="chk-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Tom B." />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add check"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------- Certificate dialog --------------------------- */

function CertificateDialog({
  venueId,
  certificate,
  open,
  onOpenChange,
}: {
  venueId: number
  certificate?: DbCertificate
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const isEdit = !!certificate
  const [internalOpen, setInternalOpen] = useState(false)
  const dialogOpen = open ?? internalOpen
  const setDialogOpen = onOpenChange ?? setInternalOpen

  const [name, setName] = useState(certificate?.name ?? "")
  const [authority, setAuthority] = useState(certificate?.authority ?? "")
  const [expires, setExpires] = useState(certificate?.expires ?? "")
  const [status, setStatus] = useState(certificate?.status ?? "Valid")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Certificate name is required.")
    setSaving(true)
    setError(null)
    const payload = { name, authority, expires, status }
    try {
      if (isEdit) {
        await updateCertificate(certificate.id, payload)
      } else {
        await createCertificate({ venueId, ...payload })
        setName("")
        setAuthority("")
        setExpires("")
        setStatus("Valid")
      }
      setDialogOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certificate.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isEdit && (
        <DialogTrigger
          render={
            <Button className="gap-1.5">
              <Plus className="size-4" /> Add certificate
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit certificate" : "Add certificate"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this certificate or licence." : "Record a certificate or licence."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cert-name">Certificate</Label>
            <Input id="cert-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Premises Licence" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cert-auth">Issuing authority</Label>
            <Input id="cert-auth" value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Bristol City Council" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cert-expires">Expires</Label>
              <Input id="cert-expires" value={expires} onChange={(e) => setExpires(e.target.value)} placeholder="30 Jun 2026" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cert-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "Valid")}>
                <SelectTrigger id="cert-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {certStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Add certificate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------- Document dialog ----------------------------- */

function DocumentDialog({ venueId }: { venueId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("General")
  const [owner, setOwner] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Document name is required.")
    setSaving(true)
    setError(null)
    try {
      await createDocument({ venueId, name, category, owner })
      setName("")
      setCategory("General")
      setOwner("")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add document.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-1.5">
            <Plus className="size-4" /> Add document
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>Add a record to the document library.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="doc-name">File name</Label>
            <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fire Risk Assessment.pdf" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="doc-cat">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "General")}>
                <SelectTrigger id="doc-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {docCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="doc-owner">Owner</Label>
              <Input id="doc-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Sarah W." />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- Main view -------------------------------- */

export function ComplianceView({
  venueId,
  checks,
  certificates,
  documents,
}: {
  venueId: number
  checks: DbComplianceCheck[]
  certificates: DbCertificate[]
  documents: DbDocument[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [editingCert, setEditingCert] = useState<DbCertificate | null>(null)
  const [deleting, setDeleting] = useState<{ kind: string; id: number; label: string } | null>(null)
  const [removing, setRemoving] = useState(false)

  const kpis: KpiType[] = useMemo(() => {
    const total = checks.length
    const complete = checks.filter((c) => c.status === "Complete").length
    const dueSoon = checks.filter((c) => c.status === "Due" || c.status === "Overdue").length
    const overdue = checks.filter((c) => c.status === "Overdue").length
    const score = total > 0 ? Math.round((complete / total) * 100) : 100
    const validCerts = certificates.filter((c) => c.status === "Valid").length
    const expiring = certificates.filter((c) => c.status === "Expiring" || c.status === "Expired").length

    return [
      {
        label: "Compliance score",
        value: `${score}%`,
        delta: `${complete}/${total} complete`,
        trend: score >= 90 ? "up" : score >= 70 ? "flat" : "down",
        hint: "all checks",
      },
      {
        label: "Checks due",
        value: String(dueSoon),
        delta: overdue > 0 ? `${overdue} overdue` : "on track",
        trend: overdue > 0 ? "down" : "flat",
        hint: "needs action",
      },
      {
        label: "Valid certificates",
        value: `${validCerts}/${certificates.length}`,
        delta: expiring > 0 ? `${expiring} to renew` : "all valid",
        trend: expiring > 0 ? "down" : "up",
        hint: "licences & certs",
      },
      {
        label: "Documents",
        value: String(documents.length),
        delta: "library",
        trend: "flat",
        hint: "stored records",
      },
    ]
  }, [checks, certificates, documents])

  async function handleLog(id: number) {
    setBusyId(id)
    try {
      await logCheck(id)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setRemoving(true)
    try {
      if (deleting.kind === "check") await deleteCheck(deleting.id)
      else if (deleting.kind === "certificate") await deleteCertificate(deleting.id)
      else if (deleting.kind === "document") await deleteDocument(deleting.id)
      setDeleting(null)
      router.refresh()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compliance"
        description="Compliance checks, certificates and documents — always audit-ready."
        actions={<CheckDialog venueId={venueId} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <Tabs defaultValue="checks">
        <TabsList>
          <TabsTrigger value="checks">Checks</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Checks */}
        <TabsContent value="checks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance checks</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {checks.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No checks yet. Use “Log a check” to add your first one.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Last done</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checks.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.frequency}</TableCell>
                        <TableCell className="text-muted-foreground">{c.owner}</TableCell>
                        <TableCell className="text-muted-foreground">{c.lastDone}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={busyId === c.id || c.status === "Complete"}
                              onClick={() => handleLog(c.id)}
                            >
                              <CheckCircle2 className="size-4" />
                              {c.status === "Complete" ? "Done" : "Mark done"}
                            </Button>
                            <RowActions
                              label={`Actions for ${c.name}`}
                              onDelete={() => setDeleting({ kind: "check", id: c.id, label: c.name })}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certificates */}
        <TabsContent value="certificates" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Certificates &amp; licences</CardTitle>
              <CertificateDialog venueId={venueId} />
            </CardHeader>
            <CardContent className="px-0">
              {certificates.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No certificates yet. Use “Add certificate” to record one.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate</TableHead>
                      <TableHead>Issuing authority</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.authority}</TableCell>
                        <TableCell className="text-muted-foreground">{c.expires}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell>
                          <RowActions
                            label={`Actions for ${c.name}`}
                            onEdit={() => setEditingCert(c)}
                            onDelete={() => setDeleting({ kind: "certificate", id: c.id, label: c.name })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Document library</CardTitle>
              <DocumentDialog venueId={venueId} />
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {documents.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No documents yet. Use “Add document” to add one.
                </p>
              ) : (
                documents.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.category} · Updated {d.updated} · {d.owner}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`Download ${d.name}`}>
                      <Download className="size-4" />
                    </Button>
                    <RowActions
                      label={`Actions for ${d.name}`}
                      onDelete={() => setDeleting({ kind: "document", id: d.id, label: d.name })}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Certificate edit dialog */}
      {editingCert && (
        <CertificateDialog
          venueId={venueId}
          certificate={editingCert}
          open={!!editingCert}
          onOpenChange={(o) => !o && setEditingCert(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {deleting?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{deleting?.label}”. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={removing}>
              {removing ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
