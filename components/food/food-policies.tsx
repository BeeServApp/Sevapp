"use client"

import { useState, useTransition } from "react"
import { Plus, FileText, ChevronDown, ExternalLink } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { RowActions } from "@/components/compliance/row-actions"
import { createFoodPolicy, deleteFoodPolicy } from "@/app/actions/food"
import type { DbFoodPolicy } from "@/lib/db/schema"

const CATEGORIES = ["HACCP", "Allergen", "Cleaning", "Personal Hygiene", "Pest Control", "Supplier", "Training"]

export function FoodPolicies({ venueId, policies }: { venueId: number; policies: DbFoodPolicy[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createFoodPolicy({
        venueId,
        title: String(formData.get("title") || ""),
        category: String(formData.get("category") || "HACCP"),
        version: String(formData.get("version") || "1.0"),
        reviewDate: String(formData.get("reviewDate") || ""),
        fileUrl: String(formData.get("fileUrl") || ""),
        content: String(formData.get("content") || ""),
      })
      setCreateOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Food safety documents</h2>
          <p className="text-sm text-muted-foreground">
            Your HACCP plan, allergen matrix, cleaning schedules and procedures.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New document
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm text-muted-foreground">
            Add your HACCP plan or allergen matrix so the team always has the latest version.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {policies.map((p) => (
            <PolicyCard key={p.id} policy={p} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogTitle>New document</DialogTitle>
          <form action={handleCreate} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fp-title">Title</Label>
              <Input id="fp-title" name="title" placeholder="HACCP plan" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select name="category" defaultValue="HACCP">
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
                <Label htmlFor="fp-version">Version</Label>
                <Input id="fp-version" name="version" defaultValue="1.0" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fp-review">Review date</Label>
              <Input id="fp-review" name="reviewDate" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fp-file">Document link (optional)</Label>
              <Input id="fp-file" name="fileUrl" type="url" placeholder="https://…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fp-content">Summary / content</Label>
              <Textarea id="fp-content" name="content" rows={5} placeholder="Summary or full text…" />
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
                {isPending ? "Saving…" : "Save document"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PolicyCard({ policy }: { policy: DbFoodPolicy }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{policy.title}</h3>
            <StatusBadge status={policy.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{policy.category}</span>
            <span>v{policy.version}</span>
            {policy.reviewDate ? <span>Review {policy.reviewDate}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {policy.fileUrl ? (
            <Button
              variant="outline"
              size="sm"
              render={
                <a href={policy.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  Open
                </a>
              }
            />
          ) : null}
          <RowActions deleteAction={() => deleteFoodPolicy(policy.id)} deleteLabel="Delete document" />
        </div>
      </div>

      {policy.content ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Hide" : "Read document"}
          </Button>
          {open ? (
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {policy.content}
            </p>
          ) : null}
        </>
      ) : null}
    </Card>
  )
}
