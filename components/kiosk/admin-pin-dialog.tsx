"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { NumericKeypad, PinDots } from "@/components/kiosk/numeric-keypad"
import { ShieldCheck } from "lucide-react"

interface AdminPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  /** Verify the entered PIN. Return true to close as success. */
  onSubmit: (pin: string) => Promise<boolean>
  onSuccess: (pin: string) => void
}

const PIN_LEN = 4

/** Reusable manager-PIN prompt used to exit lock mode and open manager areas. */
export function AdminPinDialog({
  open,
  onOpenChange,
  title = "Manager PIN",
  description = "Enter the venue manager PIN to continue.",
  onSubmit,
  onSuccess,
}: AdminPinDialogProps) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setPin("")
      setError(null)
      setBusy(false)
    }
  }, [open])

  // Support 4–6 digit PINs: auto-submit at 4 but allow more via a confirm tap.
  async function attempt(candidate: string) {
    setBusy(true)
    setError(null)
    try {
      const ok = await onSubmit(candidate)
      if (ok) {
        onSuccess(candidate)
        onOpenChange(false)
      } else {
        setError("Incorrect PIN")
        setPin("")
      }
    } catch {
      setError("Something went wrong. Try again.")
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  function handleDigit(d: string) {
    if (busy) return
    setError(null)
    const next = (pin + d).slice(0, 6)
    setPin(next)
    if (next.length === PIN_LEN) attempt(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-secondary">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 pt-1">
          <PinDots length={PIN_LEN} filled={Math.min(pin.length, PIN_LEN)} />
          {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
          <NumericKeypad
            onDigit={handleDigit}
            onBackspace={() => setPin((p) => p.slice(0, -1))}
            onClear={() => setPin("")}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
