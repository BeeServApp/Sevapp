"use client"

import { useMemo, useState, useTransition } from "react"
import {
  Plus,
  GraduationCap,
  PlayCircle,
  FileText,
  Users,
  Sparkles,
  ExternalLink,
  Trash2,
  UserPlus,
  Clock,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { RowActions } from "@/components/compliance/row-actions"
import {
  assignModule,
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  removeAssignment,
  seedStarterTraining,
  type AssignStaffOption,
  type ModuleWithDetails,
} from "@/app/actions/training"
import { AUDIENCES, type AudienceValue } from "@/lib/training"

const CATEGORIES = [
  "Cellar Management",
  "Food Training",
  "Bar Service",
  "Health & Safety",
  "Front of House",
  "General",
]

const audienceLabel: Record<string, string> = {
  everyone: "Everyone",
  kitchen: "Kitchen staff",
  bar: "Bar staff",
  foh: "Front of house",
  management: "Management",
  individual: "Individual",
}

export function TrainingHub({
  modules,
  staff,
}: {
  modules: ModuleWithDetails[]
  staff: AssignStaffOption[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const stats = useMemo(() => {
    const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0)
    const totalAssigned = modules.reduce((sum, m) => sum + m.assignedCount, 0)
    const avgCompletion = modules.length
      ? Math.round(modules.reduce((sum, m) => sum + m.completionPct, 0) / modules.length)
      : 0
    return { totalLessons, totalAssigned, avgCompletion }
  }, [modules])

  const grouped = useMemo(() => {
    const map = new Map<string, ModuleWithDetails[]>()
    for (const m of modules) {
      const list = map.get(m.category) ?? []
      list.push(m)
      map.set(m.category, list)
    }
    return Array.from(map.entries())
  }, [modules])

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createModule({
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || ""),
        category: String(formData.get("category") || "General"),
      })
      setCreateOpen(false)
    })
  }

  function handleSeed() {
    startTransition(async () => {
      await seedStarterTraining()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Training"
        description="Build video and document courses, assign them to kitchen or bar staff, and track completion across the team."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New module
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Modules" value={modules.length} />
        <StatCard icon={PlayCircle} label="Lessons" value={stats.totalLessons} />
        <StatCard icon={Users} label="Assignments" value={stats.totalAssigned} />
        <StatCard icon={Sparkles} label="Avg completion" value={`${stats.avgCompletion}%`} />
      </div>

      {modules.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <GraduationCap className="size-9 text-muted-foreground" />
          <div>
            <p className="font-medium">No training modules yet</p>
            <p className="text-sm text-muted-foreground">
              Start from scratch, or load a ready-made catalogue covering Cellar Management, Food
              Training, Bar Service and Health &amp; Safety.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={handleSeed} disabled={isPending}>
              <Sparkles className="size-4" />
              {isPending ? "Loading…" : "Load starter content"}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New module
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, list]) => (
            <section key={category} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-semibold">{category}</h2>
                <Badge variant="secondary">{list.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((m) => (
                  <ModuleCard key={m.id} module={m} staff={staff} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogTitle>New training module</DialogTitle>
          <form action={handleCreate} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tm-title">Title</Label>
              <Input id="tm-title" name="title" placeholder="Cellar Management Fundamentals" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select name="category" defaultValue="Cellar Management">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tm-desc">Description</Label>
              <Textarea
                id="tm-desc"
                name="description"
                rows={3}
                placeholder="What this course covers and who it's for…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose
                render={(props) => (
                  <Button {...props} type="button" variant="outline">
                    Cancel
                  </Button>
                )}
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create module"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap
  label: string
  value: string | number
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col">
        <span className="text-xl font-semibold leading-tight">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </Card>
  )
}

function ModuleCard({
  module,
  staff,
}: {
  module: ModuleWithDetails
  staff: AssignStaffOption[]
}) {
  const [lessonsOpen, setLessonsOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const videoCount = module.lessons.filter((l) => l.type === "video").length
  const docCount = module.lessons.filter((l) => l.type === "document").length

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium leading-tight text-balance">{module.title}</h3>
          <Badge variant="secondary" className="w-fit">
            {module.category}
          </Badge>
        </div>
        <RowActions deleteAction={() => deleteModule(module.id)} deleteLabel="Delete module" />
      </div>

      {module.description ? (
        <p className="text-sm text-muted-foreground line-clamp-3">{module.description}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <PlayCircle className="size-3.5" />
          {videoCount} video{videoCount === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="size-3.5" />
          {docCount} doc{docCount === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {module.assignedCount} assigned
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Team completion</span>
          <span className="font-medium">{module.completionPct}%</span>
        </div>
        <Progress value={module.completionPct} />
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setLessonsOpen(true)}>
          <PlayCircle className="size-4" />
          Lessons
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setAssignOpen(true)}>
          <UserPlus className="size-4" />
          Assign
        </Button>
      </div>

      <LessonManagerDialog module={module} open={lessonsOpen} onOpenChange={setLessonsOpen} />
      <AssignDialog module={module} staff={staff} open={assignOpen} onOpenChange={setAssignOpen} />
    </Card>
  )
}

function LessonManagerDialog({
  module,
  open,
  onOpenChange,
}: {
  module: ModuleWithDetails
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [type, setType] = useState<"video" | "document">("video")
  const [isPending, startTransition] = useTransition()

  function handleAdd(formData: FormData) {
    const durationRaw = String(formData.get("durationMin") || "").trim()
    startTransition(async () => {
      await createLesson({
        moduleId: module.id,
        title: String(formData.get("title") || ""),
        type,
        url: String(formData.get("url") || ""),
        content: String(formData.get("content") || ""),
        durationMin: durationRaw ? Number.parseInt(durationRaw, 10) : null,
      })
      const form = document.getElementById("add-lesson-form") as HTMLFormElement | null
      form?.reset()
      setType("video")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{module.title} — lessons</DialogTitle>

        <div className="mt-4 flex flex-col gap-2">
          {module.lessons.length === 0 ? (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              No lessons yet. Add a video link or a document below.
            </p>
          ) : (
            module.lessons.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {l.type === "video" ? (
                    <PlayCircle className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{l.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {l.type}
                    {l.durationMin ? ` · ${l.durationMin} min` : ""}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete lesson"
                  onClick={() => deleteLesson(l.id)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>

        <form id="add-lesson-form" action={handleAdd} className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          <p className="text-sm font-medium">Add a lesson</p>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType((v as "video" | "document") ?? "video")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video (link)</SelectItem>
                <SelectItem value="document">Document (to read)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tl-title">Title</Label>
            <Input id="tl-title" name="title" placeholder="Beer line cleaning walkthrough" required />
          </div>
          {type === "video" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="tl-url">Video link</Label>
                <Input id="tl-url" name="url" type="url" placeholder="https://…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tl-duration">Minutes</Label>
                <Input id="tl-duration" name="durationMin" type="number" min={0} placeholder="10" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tl-doc-url">Document link (optional)</Label>
                <Input id="tl-doc-url" name="url" type="url" placeholder="https://…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tl-content">Content to read</Label>
                <Textarea id="tl-content" name="content" rows={5} placeholder="Type the reading material…" />
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              <Plus className="size-4" />
              {isPending ? "Adding…" : "Add lesson"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssignDialog({
  module,
  staff,
  open,
  onOpenChange,
}: {
  module: ModuleWithDetails
  staff: AssignStaffOption[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [mode, setMode] = useState<"group" | "individual">("group")
  const [audience, setAudience] = useState<AudienceValue>("everyone")
  const [staffId, setStaffId] = useState<string>(staff[0] ? String(staff[0].id) : "")
  const [dueDate, setDueDate] = useState("")
  const [isPending, startTransition] = useTransition()

  const staffName = (id: number | null) => staff.find((s) => s.id === id)?.name ?? null

  function handleAssign() {
    startTransition(async () => {
      await assignModule({
        moduleId: module.id,
        audience: mode === "group" ? audience : undefined,
        staffMemberId: mode === "individual" && staffId ? Number.parseInt(staffId, 10) : null,
        dueDate: dueDate || undefined,
      })
      setDueDate("")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>Assign “{module.title}”</DialogTitle>

        <div className="mt-4 flex flex-col gap-2">
          {module.assignments.length === 0 ? (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              Not assigned yet. Choose a group or an individual below.
            </p>
          ) : (
            module.assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {a.staffMemberId ? staffName(a.staffMemberId) ?? "Staff member" : audienceLabel[a.audience]}
                  </span>
                  {a.dueDate ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      Due {a.dueDate}
                    </span>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove assignment"
                  onClick={() => removeAssignment(a.id)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>Assign to</Label>
            <Select value={mode} onValueChange={(v) => setMode((v as "group" | "individual") ?? "group")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">A group</SelectItem>
                <SelectItem value="individual">A specific person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "group" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Group</Label>
              <Select value={audience} onValueChange={(v) => setAudience((v as AudienceValue) ?? "everyone")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Staff member</Label>
              {staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No staff members yet. Add your team in HR first.
                </p>
              ) : (
                <Select value={staffId} onValueChange={(v) => setStaffId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} · {s.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ta-due">Due date (optional)</Label>
            <Input id="ta-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAssign}
              disabled={isPending || (mode === "individual" && !staffId)}
            >
              <UserPlus className="size-4" />
              {isPending ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
