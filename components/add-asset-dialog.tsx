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
import { createAsset } from "@/app/actions/assets"
import type { AssetCategory, AssetCondition, ViewAsset } from "@/lib/asset-types"

const categories: AssetCategory[] = ["Bar", "Cellar", "Kitchen", "Furniture", "AV & Tech"]
const conditions: AssetCondition[] = ["Excellent", "Good", "Fair", "Needs repair"]

interface AddAssetDialogProps {
  venueId: number
  nextAssetNumber: string
  onCreated: (asset: ViewAsset) => void
}

const emptyForm = {
  name: "",
  description: "",
  category: "" as AssetCategory | "",
  serial: "",
  price: "",
  purchaseDate: "",
  condition: "" as AssetCondition | "",
  location: "",
  photo: "",
}

export function AddAssetDialog({ venueId, nextAssetNumber, onCreated }: AddAssetDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePhoto(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update("photo", String(reader.result))
    reader.readAsDataURL(file)
  }

  function reset() {
    setForm({ ...emptyForm })
    setError(null)
    setSaving(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError("Please enter an asset name.")
    if (!form.category) return setError("Please choose a category.")
    if (!form.condition) return setError("Please choose a condition.")
    const priceNum = Number.parseFloat(form.price)
    if (Number.isNaN(priceNum) || priceNum < 0) return setError("Please enter a valid price.")

    const purchaseDate = (form.purchaseDate ? new Date(form.purchaseDate) : new Date()).toLocaleDateString(
      "en-GB",
      { day: "2-digit", month: "short", year: "numeric" },
    )

    setError(null)
    setSaving(true)
    try {
      const created = await createAsset({
        venueId,
        assetNumber: nextAssetNumber,
        name: form.name.trim(),
        description: form.description.trim() || "No description provided.",
        category: form.category,
        serial: form.serial.trim() || "—",
        price: priceNum,
        purchaseDate,
        condition: form.condition,
        location: form.location.trim() || "Unassigned",
        photo: form.photo || "/placeholder.svg",
      })

      onCreated({
        dbId: created.id,
        id: created.assetNumber,
        name: created.name,
        description: created.description ?? "",
        category: created.category as AssetCategory,
        serial: created.serial ?? "—",
        price: created.price,
        purchaseDate: created.purchaseDate ?? purchaseDate,
        condition: created.condition as AssetCondition,
        location: created.location ?? "Unassigned",
        photo: created.photo ?? "/placeholder.svg",
      })

      reset()
      setOpen(false)
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : "Failed to save asset.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" /> Add asset
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add asset</DialogTitle>
          <DialogDescription>
            Register a new fixture or fitting. Asset number {nextAssetNumber} will be assigned.
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

          <div className="grid gap-2">
            <Label htmlFor="asset-location">Location</Label>
            <Input
              id="asset-location"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="e.g. Main Bar"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
