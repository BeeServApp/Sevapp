"use client"

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
import { createProduct, updateProduct, type ProductInput } from "@/app/actions/stock"
import { computeGp, penceFromPounds, poundsFromPence, STOCK_CATEGORIES, STOCK_UNITS } from "@/lib/stock"
import type { DbStockProduct, DbSupplier } from "@/lib/db/schema"

interface ProductDialogProps {
  venueId: number
  suppliers: DbSupplier[]
  product?: DbStockProduct
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ProductDialog({ venueId, suppliers, product, open, onOpenChange }: ProductDialogProps) {
  const router = useRouter()
  const controlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlled ? open : internalOpen
  const setOpen = controlled ? onOpenChange! : setInternalOpen

  const [name, setName] = useState(product?.name ?? "")
  const [sku, setSku] = useState(product?.sku ?? "")
  const [barcode, setBarcode] = useState(product?.barcode ?? "")
  const [category, setCategory] = useState(product?.category ?? "General")
  const [unit, setUnit] = useState(product?.unit ?? "each")
  const [packSize, setPackSize] = useState(String(product?.packSize ?? 1))
  const [supplierId, setSupplierId] = useState(product?.supplierId ? String(product.supplierId) : "none")
  const [cost, setCost] = useState(product ? (product.costPricePence / 100).toFixed(2) : "")
  const [sale, setSale] = useState(product ? (product.salePricePence / 100).toFixed(2) : "")
  const [vat, setVat] = useState(String(product?.vatRatePct ?? 20))
  const [par, setPar] = useState(String(product?.parLevel ?? 0))
  const [onHand, setOnHand] = useState(String(product?.onHandQty ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const costPence = penceFromPounds(cost)
  const salePence = penceFromPounds(sale)
  const gp = computeGp(costPence, salePence, Number.parseInt(vat, 10) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const payload: ProductInput = {
      venueId,
      name,
      sku,
      barcode,
      category,
      unit,
      packSize: Number.parseInt(packSize, 10) || 1,
      supplierId: supplierId === "none" ? null : Number.parseInt(supplierId, 10),
      costPricePence: costPence,
      salePricePence: salePence,
      vatRatePct: Number.parseInt(vat, 10) || 0,
      parLevel: Number.parseFloat(par) || 0,
      onHandQty: Number.parseFloat(onHand) || 0,
    }
    try {
      if (product) await updateProduct(product.id, payload)
      else await createProduct(payload)
      setOpen(false)
      if (!product) resetForm()
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setName("")
    setSku("")
    setBarcode("")
    setCategory("General")
    setUnit("each")
    setPackSize("1")
    setSupplierId("none")
    setCost("")
    setSale("")
    setVat("20")
    setPar("0")
    setOnHand("0")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger
          render={
            <Button>
              <Plus className="size-4" /> New product
            </Button>
          }
        />
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>Define a stock line with its costing and reorder level.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Product name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-barcode">Barcode</Label>
              <Input
                id="p-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Stock unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger aria-label="Unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-pack">Pack size</Label>
              <Input
                id="p-pack"
                inputMode="numeric"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger aria-label="Supplier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-cost">Cost £ (ex-VAT)</Label>
              <Input id="p-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-sale">Sale £ (ex-VAT)</Label>
              <Input id="p-sale" inputMode="decimal" value={sale} onChange={(e) => setSale(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>VAT</Label>
              <Select value={vat} onValueChange={setVat}>
                <SelectTrigger aria-label="VAT rate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["0", "5", "20"].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {salePence > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3 text-sm">
              <span className="text-muted-foreground">Gross profit margin</span>
              <span className="font-semibold text-foreground">
                {gp.marginPct.toFixed(1)}%{" "}
                <span className="font-normal text-muted-foreground">
                  ({poundsFromPence(gp.profitPence)}/unit)
                </span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-par">Par level</Label>
              <Input id="p-par" inputMode="decimal" value={par} onChange={(e) => setPar(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-onhand">On hand now</Label>
              <Input
                id="p-onhand"
                inputMode="decimal"
                value={onHand}
                onChange={(e) => setOnHand(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving…" : product ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
