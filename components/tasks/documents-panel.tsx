"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { Building2, FileText, Loader2, MapPin, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { createDocument, deleteDocument } from "@/app/actions/oversight"
import type { DbOpsDocument } from "@/lib/db/schema"

const CATEGORIES = ["General", "COSHH", "Allergens", "Tills", "H&S", "Marketing", "Certificates"]
const SHARE_OPTIONS = ["All Venue Staff", "Managers Only", "Head Office"]

function fmtDate(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function isExpired(iso?: string | null) {
  if (!iso) return false
  return iso < new Date().toISOString().slice(0, 10)
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch("/api/upload-hr-document", { method: "POST", body: fd })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Upload failed")
  }
  const data = await res.json()
  return data.url as string
}

export function DocumentsPanel({
  venueId,
  initialDocuments,
}: {
  venueId: number
  initialDocuments: DbOpsDocument[]
}) {
  const [documents, setDocuments] = useState<DbOpsDocument[]>(initialDocuments)
  const [filter, setFilter] = useState("All")

  const categories = useMemo(() => ["All", ...CATEGORIES], [])
  const filtered = useMemo(
    () => (filter === "All" ? documents : documents.filter((d) => d.category === filter)),
    [documents, filter],
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={filter === c ? "default" : "outline"}
              onClick={() => setFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <UploadDocumentDialog venueId={venueId} onCreated={(d) => setDocuments((prev) => [d, ...prev])} />
      </div>

      {filtered.length === 0 ? (
        <Card className="items-center gap-2 border-dashed py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-5" />
          </div>
          <p className="font-medium text-foreground">No documents here yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Store documents centrally or against this venue, then share them with your team.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {filtered.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{d.name}</p>
                    <Badge variant="outline" className="border-transparent bg-muted text-xs text-muted-foreground">
                      {d.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="inline-flex items-center gap-1 border-transparent bg-muted text-xs text-muted-foreground"
                    >
                      {d.venueId === 0 ? <Building2 className="size-3" /> : <MapPin className="size-3" />}
                      {d.venueId === 0 ? "Central" : "This venue"}
                    </Badge>
                    {isExpired(d.expires) ? (
                      <Badge variant="outline" className="border-transparent bg-destructive/12 text-xs text-destructive">
                        Expired
                      </Badge>
                    ) : d.expires ? (
                      <Badge variant="outline" className="border-transparent bg-chart-4/20 text-xs text-[oklch(0.45_0.11_70)]">
                        Expires {fmtDate(d.expires)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[d.description, `Shared with ${d.sharedWith}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {d.fileUrl && (
                    <Button size="sm" variant="outline" render={<a href={d.fileUrl} target="_blank" rel="noreferrer" />}>
                      View
                    </Button>
                  )}
                  <DeleteButton id={d.id} onDeleted={(id) => setDocuments((prev) => prev.filter((x) => x.id !== id))} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function DeleteButton({ id, onDeleted }: { id: number; onDeleted: (id: number) => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        onDeleted(id)
        startTransition(() => deleteDocument(id))
      }}
      aria-label="Delete document"
    >
      <Trash2 className="size-4" />
    </Button>
  )
}

function UploadDocumentDialog({
  venueId,
  onCreated,
}: {
  venueId: number
  onCreated: (d: DbOpsDocument) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("General")
  const [sharedWith, setSharedWith] = useState("All Venue Staff")
  const [expires, setExpires] = useState("")
  const [central, setCentral] = useState(false)

  function reset() {
    setFileUrl(null)
    setFileName("")
    setName("")
    setDescription("")
    setCategory("General")
    setSharedWith("All Venue Staff")
    setExpires("")
    setCentral(false)
    setError(null)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadFile(file)
      setFileUrl(url)
      setFileName(file.name)
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    if (!name.trim()) {
      setError("Give the document a name")
      return
    }
    startTransition(async () => {
      try {
        const created = await createDocument({
          venueId,
          central,
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          fileUrl: fileUrl || undefined,
          expires: expires || undefined,
          sharedWith,
        })
        onCreated(created)
        reset()
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save document")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Upload className="size-4" />
            Upload document
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>Store a document centrally or against this venue and share it with your team.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>File</Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-3 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              <span className="truncate">
                {uploading ? "Uploading…" : fileName || "Choose a PDF, Word or image file (optional)"}
              </span>
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="d-name">Name</Label>
            <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Covid Risk Assessment" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="d-desc">Description</Label>
            <Textarea
              id="d-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "General")}>
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
            <div className="flex flex-col gap-2">
              <Label>Shared with</Label>
              <Select value={sharedWith} onValueChange={(v) => setSharedWith(v ?? "All Venue Staff")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="d-expires">Expiry / reminder date</Label>
            <Input id="d-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
          <label className="flex items-center gap-2.5 rounded-md border border-border p-3">
            <Checkbox checked={central} onCheckedChange={(c) => setCentral(c === true)} />
            <span className={cn("flex items-center gap-1.5 text-sm")}>
              <Building2 className="size-4 text-muted-foreground" />
              Store centrally (visible to all venues)
            </span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || uploading}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
