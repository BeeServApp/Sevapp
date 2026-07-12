"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { createStockSupplier, updateStockSupplier } from "@/app/actions/stock"
import type { DbSupplier } from "@/lib/db/schema"

const TERM_OPTIONS = ["Net 7", "Net 14", "Net 30", "Net 60", "On delivery"]

interface SupplierDialogProps {
  venueId: number
  supplier?: DbSupplier
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SupplierDialog({ venueId, supplier, open, onOpenChange }: SupplierDialogProps) {
  const router = useRouter()
  const controlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlled ? open : internalOpen
  const setOpen = controlled ? onOpenChange! : setInternalOpen

  const [name, setName] = useState(supplier?.name ?? "")
  const [category, setCategory] = useState(supplier?.category ?? "")
  const [terms, setTerms] = useState(supplier?.terms ?? "Net 30")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (supplier) await updateStockSupplier(supplier.id, { name, category, terms })
      else await createStockSupplier({ venueId, name, category, terms })
      setOpen(false)
      if (!supplier) {
        setName("")
        setCategory("")
        setTerms("Net 30")
      }
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger
          render={
            <Button>
              <Plus className="size-4" /> New supplier
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>Suppliers you buy stock from, used when building orders.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-name">Supplier name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-cat">Category</Label>
            <Input
              id="s-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Drinks, Food, Packaging"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Payment terms</Label>
            <Select value={terms} onValueChange={setTerms}>
              <SelectTrigger aria-label="Payment terms">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving…" : supplier ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
