"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRightLeft, Building2 } from "lucide-react"
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
import { transferStock } from "@/app/actions/stock"

export interface TransferVenueOption {
  id: number
  name: string
}

export interface TransferProductOption {
  id: number
  name: string
  venueId: number
  onHandQty: number
  unit: string
}

export function StockTransferPanel({
  venues,
  products,
}: {
  venues: TransferVenueOption[]
  products: TransferProductOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fromVenue, setFromVenue] = useState("")
  const [productId, setProductId] = useState("")
  const [toVenue, setToVenue] = useState("")
  const [qty, setQty] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceProducts = useMemo(
    () => products.filter((p) => String(p.venueId) === fromVenue && p.onHandQty > 0),
    [products, fromVenue],
  )
  const selectedProduct = sourceProducts.find((p) => String(p.id) === productId)
  const destinationVenues = venues.filter((v) => String(v.id) !== fromVenue)

  function reset() {
    setFromVenue("")
    setProductId("")
    setToVenue("")
    setQty("")
    setNote("")
    setError(null)
  }

  async function handleTransfer() {
    setError(null)
    if (!fromVenue || !productId || !toVenue) {
      setError("Choose a source venue, product and destination")
      return
    }
    const q = Number(qty)
    if (!Number.isFinite(q) || q <= 0) {
      setError("Enter a quantity greater than zero")
      return
    }
    if (selectedProduct && q > selectedProduct.onHandQty) {
      setError(`Only ${selectedProduct.onHandQty} ${selectedProduct.unit} on hand`)
      return
    }
    setBusy(true)
    try {
      await transferStock({
        fromVenueId: Number(fromVenue),
        fromProductId: Number(productId),
        toVenueId: Number(toVenue),
        qty: q,
        note,
      })
      reset()
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not transfer stock")
    } finally {
      setBusy(false)
    }
  }

  const canTransfer = venues.length >= 2

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button className="gap-2" disabled={!canTransfer}>
            <ArrowRightLeft className="size-4" />
            Transfer stock
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-4" /> Transfer stock between venues
          </DialogTitle>
          <DialogDescription>
            Move stock from one venue to another. The quantity is deducted from the source and added to
            the matching product at the destination (created there if needed).
          </DialogDescription>
        </DialogHeader>

        {!canTransfer ? (
          <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
            You need at least two venues to transfer stock. Add another venue in Settings.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="from-venue">From venue</Label>
              <Select
                value={fromVenue}
                onValueChange={(v) => {
                  setFromVenue(v ?? "")
                  setProductId("")
                  if (v === toVenue) setToVenue("")
                }}
              >
                <SelectTrigger id="from-venue" className="w-full">
                  <SelectValue placeholder="Select source venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      <span className="flex items-center gap-2">
                        <Building2 className="size-4 text-muted-foreground" /> {v.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product">Product</Label>
              <Select value={productId} onValueChange={(v) => setProductId(v ?? "")} disabled={!fromVenue}>
                <SelectTrigger id="product" className="w-full">
                  <SelectValue placeholder={fromVenue ? "Select a product" : "Pick a source venue first"} />
                </SelectTrigger>
                <SelectContent>
                  {sourceProducts.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No stock on hand</div>
                  ) : (
                    sourceProducts.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} · {p.onHandQty} {p.unit}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="0"
                />
                {selectedProduct && (
                  <span className="text-xs text-muted-foreground">
                    {selectedProduct.onHandQty} {selectedProduct.unit} available
                  </span>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="to-venue">To venue</Label>
                <Select value={toVenue} onValueChange={(v) => setToVenue(v ?? "")} disabled={!fromVenue}>
                  <SelectTrigger id="to-venue" className="w-full">
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationVenues.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. covering a shortage for the weekend"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={busy || !canTransfer}>
            {busy ? "Transferring..." : "Transfer stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
