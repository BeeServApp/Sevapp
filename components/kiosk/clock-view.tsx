"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, LogIn, LogOut, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { NumericKeypad, PinDots } from "@/components/kiosk/numeric-keypad"
import { kioskClockPunch } from "@/app/actions/kiosk"

type Result = { name: string; action: "in" | "out" } | { error: string }

export function ClockView({ onPunch }: { onPunch: () => void }) {
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  // Auto-clear the result banner after a few seconds.
  useEffect(() => {
    if (!result) return
    const id = setTimeout(() => setResult(null), 4000)
    return () => clearTimeout(id)
  }, [result])

  async function submit(next: string) {
    setBusy(true)
    try {
      const res = await kioskClockPunch(next)
      if (res.ok && res.name && res.action) {
        setResult({ name: res.name, action: res.action })
        onPunch()
      } else {
        setResult({ error: res.error ?? "Try again" })
      }
    } finally {
      setBusy(false)
      setPin("")
    }
  }

  function onDigit(d: string) {
    if (busy) return
    const next = pin + d
    if (next.length > 4) return
    setPin(next)
    if (next.length === 4) void submit(next)
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-6 py-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-balance">Clock in / out</h1>
        <p className="mt-1 text-muted-foreground">Enter your 4-digit PIN</p>
      </div>

      {result && "name" in result ? (
        <div
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left font-semibold",
            result.action === "in" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
          )}
        >
          {result.action === "in" ? <LogIn className="size-6" /> : <LogOut className="size-6" />}
          <div>
            <div className="text-lg">
              {result.name} clocked {result.action}
            </div>
            <div className="text-xs font-normal opacity-80">
              {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <CheckCircle2 className="ml-auto size-6" />
        </div>
      ) : result && "error" in result ? (
        <div className="flex w-full items-center gap-3 rounded-2xl bg-destructive/10 px-5 py-4 font-semibold text-destructive">
          <XCircle className="size-6" />
          {result.error}
        </div>
      ) : (
        <PinDots length={4} filled={pin.length} />
      )}

      <NumericKeypad onDigit={onDigit} onBackspace={() => setPin((p) => p.slice(0, -1))} onClear={() => setPin("")} />
    </div>
  )
}
