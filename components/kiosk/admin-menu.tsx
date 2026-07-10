"use client"

import { useState } from "react"
import { Loader2, LogOut, Maximize, Minimize, ShieldQuestion } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { NumericKeypad, PinDots } from "@/components/kiosk/numeric-keypad"
import { unpairKioskDevice, verifyKioskAdminPin } from "@/app/actions/kiosk"

type Step = "pin" | "menu" | "guided"

export function AdminMenu({
  hasAdminPin,
  onUnpaired,
  children,
}: {
  hasAdminPin: boolean
  onUnpaired: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(hasAdminPin ? "pin" : "menu")
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setStep(hasAdminPin ? "pin" : "menu")
    setPin("")
    setError(null)
  }

  async function verify(next: string) {
    setBusy(true)
    setError(null)
    try {
      const ok = await verifyKioskAdminPin(next)
      if (ok) setStep("menu")
      else {
        setError("Incorrect PIN")
        setPin("")
      }
    } finally {
      setBusy(false)
    }
  }

  function onDigit(d: string) {
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    if (next.length >= 4 && next.length <= 6) {
      // Auto-submit at 4; allow up to 6 by verifying on each length.
      if (next.length === 4) void verify(next)
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
    setOpen(false)
    reset()
  }

  async function doUnpair() {
    setBusy(true)
    try {
      // PIN already verified to reach the menu; re-send it for the server check.
      const res = await unpairKioskDevice(pin || "0000")
      if (res.ok) {
        setOpen(false)
        onUnpaired()
      } else {
        setError("Could not unpair — re-enter PIN")
        setStep("pin")
        setPin("")
      }
    } finally {
      setBusy(false)
    }
  }

  const isFullscreen = typeof document !== "undefined" && !!document.fullscreenElement

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <button type="button" aria-label="Kiosk menu">
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        {step === "pin" && (
          <>
            <DialogHeader>
              <DialogTitle>Manager PIN</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Enter the manager PIN to access kiosk controls.</p>
            <div className="my-4">
              <PinDots length={4} filled={pin.length} />
            </div>
            {error && <p className="mb-3 text-center text-sm font-medium text-destructive">{error}</p>}
            <NumericKeypad
              onDigit={onDigit}
              onBackspace={() => setPin((p) => p.slice(0, -1))}
              onClear={() => setPin("")}
            />
            {busy && (
              <div className="mt-3 flex justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
          </>
        )}

        {step === "menu" && (
          <>
            <DialogHeader>
              <DialogTitle>Kiosk controls</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-4 text-left font-medium text-secondary-foreground active:scale-[0.98]"
              >
                {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                {isFullscreen ? "Exit full screen" : "Enter full screen (lock)"}
              </button>
              <button
                type="button"
                onClick={() => setStep("guided")}
                className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-4 text-left font-medium text-secondary-foreground active:scale-[0.98]"
              >
                <ShieldQuestion className="size-5" />
                iOS Guided Access setup
              </button>
              <button
                type="button"
                onClick={doUnpair}
                disabled={busy}
                className="flex items-center gap-3 rounded-xl bg-destructive px-4 py-4 text-left font-medium text-white active:scale-[0.98] disabled:opacity-50"
              >
                <LogOut className="size-5" />
                Unpair this device
              </button>
            </div>
          </>
        )}

        {step === "guided" && (
          <>
            <DialogHeader>
              <DialogTitle>Lock the iPad with Guided Access</DialogTitle>
            </DialogHeader>
            <ol className="list-decimal space-y-2 pl-5 pt-2 text-sm text-muted-foreground">
              <li>Open iOS Settings → Accessibility → Guided Access, and turn it On.</li>
              <li>Set a Guided Access passcode (keep it separate from the manager PIN).</li>
              <li>Open this kiosk in Safari and tap “Enter full screen (lock)”.</li>
              <li>Triple-click the side/home button, then tap Start.</li>
              <li>To exit: triple-click again and enter the Guided Access passcode.</li>
            </ol>
            <button
              type="button"
              onClick={() => setStep("menu")}
              className="mt-4 w-full rounded-xl bg-secondary py-3 font-medium text-secondary-foreground active:scale-[0.98]"
            >
              Back
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
