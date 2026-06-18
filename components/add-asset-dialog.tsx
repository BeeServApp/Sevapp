"use client"

import type React from "react"
import { useRef, useState } from "react"
import Image from "next/image"
import { Plus, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { createAsset, updateAsset } from "@/app/actions/assets"
import type { AssetCategory, AssetCondition, ViewAsset } from "@/lib/asset-types"

const categories: AssetCategory[] = ["Bar", "Cellar", "Kitchen", "Furniture", "AV & Tech"]
const conditions: AssetCondition[] = ["Excellent", "Good", "Fair", "Needs repair"]

// Convert a display date ("14 Mar 2023") into an <input type="date"> value.
function toInputDate(display: string): string {
  if (!display) return ""
  const t = Date.parse(display)
  if (Number.isNaN(t)) return ""
  const d = new Date(t)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

// Format an <input type="date"> value into the app's display format.
function toDisplayDate(input: string): string {
  if (!input) return ""
  return new Date(input).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

interface AssetDialogProps {
  venueId: number
  mode?: "create" | "edit"
  asset?: ViewAsset
  nextAssetNumber?: string
  onSaved: (asset: ViewAsset) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function emptyForm() {
  return {
    name: "",
    description: "",
    category: "" as AssetCategory | "",
    serial: "",
    price: "",
    purchaseDate: "",
    disposalDate: "",
    condition: "" as AssetCondition | "",
    location: "",
    photo: "",
  }
}

function formFromAsset(a: ViewAsset) {
  return {
    name: a.name,
    description: a.description === "No description provided." ? "" : a.description,
    category: a.category,
    serial: a.serial === "—" ? "" : a.serial,
    price: String(a.price),
    purchaseDate: toInputDate(a.purchaseDate),
    disposalDate: toInputDate(a.disposalDate),
    condition: a.condition,
    location: a.location === "Unassigned" ? "" : a.location,
    photo: a.photo === "/placeholder.svg" ? "" : a.photo,
  }
}

export function AssetDialog({
  venueId,
  mode = "create",
  asset,
  nextAssetNumber,
  onSaved,
  open: controlledOpen,
  onOpenChange,
}: AssetDialogProps) {
  const isEdit = mode === "edit"
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const [form, setForm] = useState(() =>
    isEdit && asset ? formFromAsset(asset) : emptyForm(),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePhoto(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update("photo", String(reader.result))
    reader.readAsDataURL(file)
  }

  // When the dialog opens, sync the form with the latest asset (edit) or clear it (create).
  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(isEdit && asset ? formFromAsset(asset) : emptyForm())
      setError(null)
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    setOpen(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError("Please enter an asset name.")
    if (!form.category) return setError("Please choose a category.")
    if (!form.condition) return setError("Please choose a condition.")
    const priceNum = Number.parseFloat(form.price)
    if (Number.isNaN(priceNum) || priceNum < 0) return setError("Please enter a valid price.")
    if (form.disposalDate && form.purchaseDate && Date.parse(form.disposalDate) < Date.parse(form.purchaseDate)) {
      return setError("Disposal date cannot be before the purchase date.")
    }

    const purchaseDisplay = form.purchaseDate
      ? toDisplayDate(form.purchaseDate)
      : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    const disposalDisplay = toDisplayDate(form.disposalDate)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || "No description provided.",
      category: form.category,
      serial: form.serial.trim() || "—",
      price: priceNum,
      purchaseDate: purchaseDisplay,
      disposalDate: disposalDisplay,
      condition: form.condition,
      location: form.location.trim() || "Unassigned",
      photo: form.photo || "/placeholder.svg",
    }

    setError(null)
    setSaving(true)
    try {
      const saved =
        isEdit && asset
          ? await updateAsset(asset.dbId, payload)
          : await createAsset({ venueId, assetNumber: nextAssetNumber ?? "AST-001", ...payload })

      onSaved({
        dbId: saved.id,
        id: saved.assetNumber,
        name: saved.name,
        description: saved.description ?? "",
        category: saved.category as AssetCategory,
        serial: saved.serial ?? "—",
        price: saved.price,
        purchaseDate: saved.purchaseDate ?? purchaseDisplay,
        disposalDate: saved.disposalDate ?? "",
        condition: saved.condition as AssetCondition,
        location: saved.location ?? "Unassigned",
        photo: saved.photo ?? "/placeholder.svg",
      })

      setOpen(false)
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : "Failed to save asset.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEdit && (
        <DialogTrigger render={<Button className="gap-1.5" />}>
          <Plus className="size-4" /> Add asset
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update the details for ${asset?.id}.`
              : `Register a new fixture or fitting. Asset number ${nextAssetNumber} will be assigned.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Photo upload */}
          <div className="grid gap-2">
            <Label>Photo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
            {form.photo ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-muted">
                <Image src={form.photo || "/placeholder.svg"} alt="Asset preview" fill className="object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 size-7"
                  onClick={() => {
                    update("photo", "")
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                >
                  <X className="size-4" />
                  <span className="sr-only">Remove photo</span>
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <Upload className="size-5" />
                Click to upload a photo
              </button>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Cask Ale Hand Pumps"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="asset-description">Description</Label>
            <Textarea
              id="asset-description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Short description of the asset"
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="asset-category">Category</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v as AssetCategory)}>
                <SelectTrigger id="asset-category">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-condition">Condition</Label>
              <Select value={form.condition} onValueChange={(v) => update("condition", v as AssetCondition)}>
                <SelectTrigger id="asset-condition">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="asset-serial">Serial number</Label>
            <Input
              id="asset-serial"
              value={form.serial}
              onChange={(e) => update("serial", e.target.value)}
              placeholder="e.g. ANG-HP6-88421"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="asset-price">Price (£)</Label>
              <Input
                id="asset-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-date">Purchase date</Label>
              <Input
                id="asset-date"
                type="date"
                value={form.purchaseDate}
                onChange={(e) => update("purchaseDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="asset-location">Location</Label>
              <Input
                id="asset-location"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="e.g. Main Bar"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-disposal">Disposal date</Label>
              <Input
                id="asset-disposal"
                type="date"
                value={form.disposalDate}
                onChange={(e) => update("disposalDate", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank if still in use.</p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Add asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
