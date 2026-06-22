"use client"

import { useState, useTransition } from "react"
import { Plus, FileText, UserCheck, ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { RowActions } from "@/components/compliance/row-actions"
import { createPolicy, acknowledgePolicy, deletePolicy } from "@/app/actions/safety"

type Ack = { id: number; staffName: string; acknowledgedAt: string | Date }
type Policy = {
  id: number
  title: string
  category: string
  version: string
  reviewDate: string | null
  content: string | null
  status: string
  acks: Ack[]
}

const CATEGORIES = ["General", "Health & Safety", "Food Safety", "HR", "Fire Safety", "Licensing"]

export function StaffPolicies({ venueId, policies }: { venueId: number; policies: Policy[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createPolicy({
        venueId,
        title: String(formData.get("title") || ""),
        category: String(formData.get("category") || "General"),
        version: String(formData.get("version") || "1.0"),
        reviewDate: String(formData.get("reviewDate") || ""),
        content: String(formData.get("content") || ""),
      })
      setCreateOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Staff policies</h2>
          <p className="text-sm text-muted-foreground">
            Publish policies and track staff acknowledgements.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="font-medium">No policies yet</p>
          <p className="text-sm text-muted-foreground">
            Add your first staff policy for the team to read and acknowledge.
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
          <DialogTitle>New policy</DialogTitle>
          <form action={handleCreate} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pol-title">Title</Label>
              <Input id="pol-title" name="title" placeholder="Health & Safety policy" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select name="category" defaultValue="General">
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
                <Label htmlFor="pol-version">Version</Label>
                <Input id="pol-version" name="version" defaultValue="1.0" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pol-review">Review date</Label>
              <Input id="pol-review" name="reviewDate" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pol-content">Policy content</Label>
              <Textarea
                id="pol-content"
                name="content"
                rows={5}
                placeholder="Summary or full text of the policy…"
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
                {isPending ? "Publishing…" : "Publish policy"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PolicyCard({ policy }: { policy: Policy }) {
  const [open, setOpen] = useState(false)
  const [ackOpen, setAckOpen] = useState(false)
  const [name, setName] = useState("")
  const [isPending, startTransition] = useTransition()

  function acknowledge() {
    if (!name.trim()) return
    startTransition(async () => {
      await acknowledgePolicy(policy.id, name)
      setName("")
      setAckOpen(false)
    })
  }

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
            <span className="flex items-center gap-1">
              <UserCheck className="size-3" />
              {policy.acks.length} acknowledged
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAckOpen(true)}>
            Acknowledge
          </Button>
          <RowActions deleteAction={() => deletePolicy(policy.id)} deleteLabel="Delete policy" />
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
            {open ? "Hide" : "Read policy"}
          </Button>
          {open ? (
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {policy.content}
            </p>
          ) : null}
        </>
      ) : null}

      {policy.acks.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {policy.acks.map((a) => (
            <span
              key={a.id}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {a.staffName}
            </span>
          ))}
        </div>
      ) : null}

      <Dialog open={ackOpen} onOpenChange={setAckOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Acknowledge policy</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm you have read &quot;{policy.title}&quot;.
          </p>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor={`ack-${policy.id}`}>Your name</Label>
            <Input
              id={`ack-${policy.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose
              render={(props) => (
                <Button {...props} type="button" variant="outline">
                  Cancel
                </Button>
              )}
            />
            <Button onClick={acknowledge} disabled={isPending || !name.trim()}>
              {isPending ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
