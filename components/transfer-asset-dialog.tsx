"use client"

import { useState } from "react"
import { ArrowRightLeft, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { transferAsset } from "@/app/actions/assets"
import type { ViewAsset } from "@/lib/asset-types"

export interface TransferVenue {
  id: number
  name: string
}

export function TransferAssetDialog({
  asset,
  currentVenueId,
  venues,
  open,
  onOpenChange,
  onTransferred,
}: {
  asset: ViewAsset
  currentVenueId: number
  venues: TransferVenue[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onTransferred: (assetDbId: number) => void
}) {
  const targets = venues.filter((v) => v.id !== currentVenueId)
  const [targetId, setTargetId] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTransfer() {
    if (!targetId) {
      setError("Select a destination venue")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await transferAsset(asset.dbId, Number(targetId))
      onTransferred(asset.dbId)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not transfer asset")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-4" /> Transfer asset
          </DialogTitle>
          <DialogDescription>
            Move {asset.id} – {asset.name} to another venue. Its maintenance history moves with it, and
            any linked gaming machine is unlinked.
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
            You only have one venue. Add another venue in Settings to transfer assets between them.
          </p>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="transfer-venue">Destination venue</Label>
            <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
              <SelectTrigger id="transfer-venue" className="w-full">
                <SelectValue placeholder="Select a venue" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    <span className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" /> {v.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={busy || targets.length === 0}>
            {busy ? "Transferring..." : "Transfer asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
