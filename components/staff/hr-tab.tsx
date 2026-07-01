"use client"

import { useMemo, useState, useTransition } from "react"
import {
  UserPlus,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Upload,
  AlertTriangle,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OnboardingForm } from "@/components/staff/onboarding-form"
import { cn } from "@/lib/utils"
import type { DbStaffMember, DbOnboarding, DbOnboardingTask, DbHrDocument } from "@/lib/db/schema"
import {
  ensureOnboarding,
  saveOnboarding,
  approveOnboarding,
  setRightToWorkChecked,
  getOnboardingTasks,
  toggleOnboardingTask,
  addOnboardingTask,
  deleteOnboardingTask,
  addHrDocument,
  deleteHrDocument,
  type OnboardingInput,
} from "@/app/actions/hr"
import { DOCUMENT_CATEGORIES, daysUntil, onboardingCompletionPct } from "@/lib/hr"

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "In progress", cls: "bg-chart-4/20 text-[oklch(0.45_0.11_70)]" },
  submitted: { label: "Submitted", cls: "bg-primary/15 text-primary" },
  approved: { label: "Approved", cls: "bg-chart-2/15 text-chart-2" },
}

interface Props {
  venueId: number
  staff: DbStaffMember[]
  initialOnboarding: DbOnboarding[]
  initialDocuments: DbHrDocument[]
}

export function HrTab({ venueId, staff, initialOnboarding, initialDocuments }: Props) {
  const [records, setRecords] = useState<DbOnboarding[]>(initialOnboarding)
  const [documents, setDocuments] = useState<DbHrDocument[]>(initialDocuments)
  const [openStaffId, setOpenStaffId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<DbOnboardingTask[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const recordByStaff = useMemo(() => {
    const m = new Map<number, DbOnboarding>()
    for (const r of records) m.set(r.staffMemberId, r)
    return m
  }, [records])

  const openMember = staff.find((s) => s.id === openStaffId) ?? null
  const openRecord = openStaffId != null ? recordByStaff.get(openStaffId) ?? null : null

  async function openHire(member: DbStaffMember) {
    setOpenStaffId(member.id)
    setLoadingDetail(true)
    try {
      // Lazily create the onboarding record + checklist on first open.
      const rec = await ensureOnboarding(venueId, member.id)
      setRecords((prev) => {
        const without = prev.filter((r) => r.staffMemberId !== member.id)
        return [...without, rec]
      })
      const t = await getOnboardingTasks(member.id)
      setTasks(t)
    } finally {
      setLoadingDetail(false)
    }
  }

  function replaceRecord(rec: DbOnboarding | undefined) {
    if (!rec) return
    setRecords((prev) => {
      const without = prev.filter((r) => r.staffMemberId !== rec.staffMemberId)
      return [...without, rec]
    })
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (openMember) {
    return (
      <HireDetail
        venueId={venueId}
        member={openMember}
        record={openRecord}
        tasks={tasks}
        loading={loadingDetail}
        documents={documents.filter((d) => d.staffMemberId === openMember.id)}
        onBack={() => setOpenStaffId(null)}
        onRecordChange={replaceRecord}
        onTasksChange={setTasks}
        onDocumentsChange={setDocuments}
      />
    )
  }

  // ── Overview: hires + expiring documents ────────────────────────────────────
  const expiring = documents
    .map((d) => ({ doc: d, days: daysUntil(d.expiryDate) }))
    .filter((x) => x.days !== null && x.days <= 60)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Onboarding</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              UK payroll-ready onboarding for every team member. Click a person to complete or review their pack.
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {staff.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Add team members in the Team tab to start onboarding.
            </p>
          ) : (
            staff.map((member) => {
              const rec = recordByStaff.get(member.id)
              const status = rec?.status ?? "not_started"
              const meta = STATUS_META[status]
              const pct = rec ? onboardingCompletionPct(rec as Record<string, unknown>) : 0
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => openHire(member)}
                  className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{member.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{member.role}</p>
                  </div>
                  {rec?.rightToWorkChecked && (
                    <Badge variant="outline" className="hidden gap-1 border-chart-2/30 text-chart-2 sm:inline-flex">
                      <ShieldCheck className="size-3" /> RTW
                    </Badge>
                  )}
                  <div className="hidden w-32 sm:block">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("border-transparent font-medium", meta.cls)}>
                    {meta.label}
                  </Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Expiring documents reminder */}
      {expiring.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-chart-4" />
              Documents expiring soon
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {expiring.map(({ doc, days }) => {
              const member = staff.find((s) => s.id === doc.staffMemberId)
              return (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 text-sm">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{doc.name}</span>
                  <span className="text-muted-foreground">{member ? `· ${member.name}` : "· Company-wide"}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-auto border-transparent font-medium",
                      (days ?? 0) < 0 ? "bg-destructive/12 text-destructive" : "bg-chart-4/20 text-[oklch(0.45_0.11_70)]",
                    )}
                  >
                    {(days ?? 0) < 0 ? `Expired ${Math.abs(days ?? 0)}d ago` : `${days}d left`}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Hire detail ───────────────────────────────────────────────────────────────

interface DetailProps {
  venueId: number
  member: DbStaffMember
  record: DbOnboarding | null
  tasks: DbOnboardingTask[]
  loading: boolean
  documents: DbHrDocument[]
  onBack: () => void
  onRecordChange: (rec: DbOnboarding | undefined) => void
  onTasksChange: (tasks: DbOnboardingTask[]) => void
  onDocumentsChange: (updater: (prev: DbHrDocument[]) => DbHrDocument[]) => void
}

function HireDetail({
  venueId,
  member,
  record,
  tasks,
  loading,
  documents,
  onBack,
  onRecordChange,
  onTasksChange,
  onDocumentsChange,
}: DetailProps) {
  const [isPending, startTransition] = useTransition()
  const [approveError, setApproveError] = useState<string[] | null>(null)
  const [newTask, setNewTask] = useState("")

  const doneCount = tasks.filter((t) => t.done).length

  async function handleSave(input: OnboardingInput) {
    const updated = await saveOnboarding(member.id, input)
    onRecordChange(updated)
  }

  function handleToggleRtw(checked: boolean) {
    startTransition(async () => {
      const updated = await setRightToWorkChecked(member.id, checked)
      onRecordChange(updated)
    })
  }

  function handleApprove() {
    setApproveError(null)
    startTransition(async () => {
      const res = await approveOnboarding(member.id)
      if (!res.ok) {
        setApproveError(res.missing ?? [])
      } else {
        onRecordChange(res.record)
      }
    })
  }

  function toggleTask(t: DbOnboardingTask) {
    // Optimistic
    onTasksChange(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
    startTransition(async () => {
      await toggleOnboardingTask(t.id, !t.done)
    })
  }

  async function handleAddTask() {
    const label = newTask.trim()
    if (!label) return
    setNewTask("")
    const created = await addOnboardingTask({ venueId, staffMemberId: member.id, label })
    onTasksChange([...tasks, created])
  }

  async function handleDeleteTask(id: number) {
    onTasksChange(tasks.filter((t) => t.id !== id))
    await deleteOnboardingTask(id)
  }

  const status = record?.status ?? "not_started"
  const meta = STATUS_META[status]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{member.name}</p>
          <p className="text-sm text-muted-foreground">{member.role}</p>
        </div>
        <Badge variant="outline" className={cn("ml-auto border-transparent font-medium", meta.cls)}>
          {meta.label}
        </Badge>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading onboarding…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: onboarding form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statutory onboarding details</CardTitle>
              </CardHeader>
              <CardContent>
                <OnboardingForm
                  key={member.id}
                  record={record}
                  onSave={handleSave}
                  showEmploymentTerms
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: RTW, checklist, docs, approval */}
          <div className="flex flex-col gap-6">
            {/* Right to Work verification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="size-4" /> Right to Work check
                </CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={record?.rightToWorkChecked ?? false}
                    disabled={isPending}
                    onCheckedChange={(v) => handleToggleRtw(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span className="text-muted-foreground">
                    I have seen the original documents (or verified the online share code) and confirmed this person&apos;s right
                    to work in the UK.
                  </span>
                </label>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Onboarding checklist</CardTitle>
                <Badge variant="outline" className="tabular-nums">
                  {doneCount}/{tasks.length}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {tasks.map((t) => (
                  <div key={t.id} className="group flex items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-accent/50">
                    <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t)} className="mt-0.5" />
                    <span className={cn("flex-1 text-sm", t.done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {t.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Delete task"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={newTask}
                    placeholder="Add a step…"
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        handleAddTask()
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={handleAddTask} className="shrink-0">
                    <Plus className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <DocumentsCard
              venueId={venueId}
              staffMemberId={member.id}
              documents={documents}
              onChange={onDocumentsChange}
            />

            {/* Approval */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approval</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {status === "approved" ? (
                  <div className="flex items-center gap-2 text-sm text-chart-2">
                    <CheckCircle2 className="size-4" />
                    Onboarding approved and payroll-ready.
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Approve once all statutory details are complete and the Right to Work check is done.
                    </p>
                    {approveError && approveError.length > 0 && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        <p className="font-medium">Still missing:</p>
                        <ul className="mt-1 list-inside list-disc">
                          {approveError.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Button onClick={handleApprove} disabled={isPending} className="gap-1">
                      <CheckCircle2 className="size-4" />
                      Approve onboarding
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Documents card (reused for a hire) ─────────────────────────────────────────

function DocumentsCard({
  venueId,
  staffMemberId,
  documents,
  onChange,
}: {
  venueId: number
  staffMemberId: number
  documents: DbHrDocument[]
  onChange: (updater: (prev: DbHrDocument[]) => DbHrDocument[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    category: "contract",
    expiryDate: "",
    fileUrl: "" as string | null,
  })

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload-hr-document", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      setForm((f) => ({ ...f, fileUrl: data.url, name: f.name || data.name }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) return setError("Give the document a name.")
    const created = await addHrDocument({
      venueId,
      staffMemberId,
      name: form.name.trim(),
      category: form.category,
      fileUrl: form.fileUrl,
      expiryDate: form.expiryDate || null,
    })
    onChange((prev) => [...prev, created])
    setOpen(false)
    setForm({ name: "", category: "contract", expiryDate: "", fileUrl: null })
  }

  async function handleDelete(id: number) {
    onChange((prev) => prev.filter((d) => d.id !== id))
    await deleteHrDocument(id)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Documents</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1">
          <Plus className="size-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {documents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          documents.map((d) => {
            const days = daysUntil(d.expiryDate)
            return (
              <div key={d.id} className="group flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-foreground hover:underline">
                      {d.name}
                    </a>
                  ) : (
                    <span className="truncate font-medium text-foreground">{d.name}</span>
                  )}
                  <p className="text-xs capitalize text-muted-foreground">{d.category}</p>
                </div>
                {days !== null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent text-xs font-medium",
                      days < 0
                        ? "bg-destructive/12 text-destructive"
                        : days <= 60
                          ? "bg-chart-4/20 text-[oklch(0.45_0.11_70)]"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {days < 0 ? "Expired" : `${days}d`}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete document"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            )
          })
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>Store contracts, Right to Work evidence, certifications and more.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Document name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "other" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Expiry date (optional)</Label>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>File (PDF, Word or image)</Label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent",
                  uploading && "opacity-60",
                )}
              >
                <Upload className="size-4" />
                {uploading ? "Uploading…" : form.fileUrl ? "File attached — choose another" : "Choose file"}
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.doc,.docx,image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </label>
              {form.fileUrl && <p className="text-xs text-chart-2">File uploaded.</p>}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={uploading}>
              Add document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
