"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, CreditCard, Check, Loader2, TabletSmartphone } from "lucide-react"

import type { DbPosTerminal } from "@/lib/db/schema"
import { cn } from "@/lib/utils"
import { formatPence, parsePoundsToPence } from "@/lib/pos-format"
import { createPosSale } from "@/app/actions/pos"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { OrderLine } from "@/components/pos/till-view"

type Method = "cash" | "terminal"
type Step = "method" | "processing" | "receipt"

export function PayDialog({
  open,
  onOpenChange,
  venueId,
  userName,
  lines,
  totalPence,
  terminals,
  onPaid,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: number
  userName: string
  lines: OrderLine[]
  totalPence: number
  terminals: DbPosTerminal[]
  onPaid: (totalPence: number) => void
}) {
  const [method, setMethod] = useState<Method>("cash")
  const [step, setStep] = useState<Step>("method")
  const [cashInput, setCashInput] = useState("")
  const [terminalId, setTerminalId] = useState<number | null>(terminals[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ changePence: number; method: Method; simulated: boolean } | null>(null)

  // Reset the flow whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setMethod("cash")
      setStep("method")
      setCashInput("")
      setTerminalId(terminals[0]?.id ?? null)
      setError(null)
      setReceipt(null)
    }
  }, [open, terminals])

  const tenderedPence = useMemo(() => parsePoundsToPence(cashInput), [cashInput])
  const changePence = tenderedPence != null ? tenderedPence - totalPence : null
  const cashShort = method === "cash" && (tenderedPence == null || tenderedPence < totalPence)

  const quickAmounts = useMemo(() => quickTenderOptions(totalPence), [totalPence])

  async function submit() {
    setError(null)
    setStep("processing")
    try {
      const res = await createPosSale({
        venueId,
        lines: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          unitPricePence: l.unitPricePence,
          qty: l.qty,
        })),
        paymentMethod: method,
        tenderedPence: method === "cash" ? (tenderedPence ?? totalPence) : undefined,
        terminalId: method === "terminal" ? terminalId : undefined,
      })
      if (!res.ok || !res.receipt) {
        setError(res.error ?? "Payment failed")
        setStep("method")
        return
      }
      setReceipt({
        changePence: res.receipt.order.changePence ?? 0,
        method,
        simulated: res.receipt.simulated,
      })
      setStep("receipt")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
      setStep("method")
    }
  }

  function finish() {
    onPaid(totalPence)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "receipt" && receipt ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Check className="size-7" />
              </div>
              <DialogTitle className="text-center">Payment complete</DialogTitle>
              <DialogDescription className="text-center">
                {formatPence(totalPence)} paid by {receipt.method === "cash" ? "cash" : "card terminal"}.
                {receipt.simulated ? " (simulated)" : ""}
              </DialogDescription>
            </DialogHeader>
            {receipt.method === "cash" && (
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">Change due</p>
                <p className="text-2xl font-bold text-foreground">{formatPence(receipt.changePence)}</p>
              </div>
            )}
            <Button className="h-12 w-full" onClick={finish}>
              New order
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Take payment</DialogTitle>
              <DialogDescription>
                {formatPence(totalPence)} total · served by {userName}
              </DialogDescription>
            </DialogHeader>

            {/* Method toggle */}
            <div className="grid grid-cols-2 gap-2">
              <MethodButton
                active={method === "cash"}
                onClick={() => setMethod("cash")}
                icon={<Banknote className="size-5" />}
                label="Cash"
              />
              <MethodButton
                active={method === "terminal"}
                onClick={() => setMethod("terminal")}
                icon={<CreditCard className="size-5" />}
                label="Card terminal"
              />
            </div>

            {method === "cash" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cash-tendered">Cash received</Label>
                  <Input
                    id="cash-tendered"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    className="h-12 text-lg"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashInput((amt / 100).toFixed(2))}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {formatPence(amt)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="text-sm text-muted-foreground">Change</span>
                  <span className="text-lg font-semibold text-foreground">
                    {changePence != null && changePence >= 0 ? formatPence(changePence) : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {terminals.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
                    <TabletSmartphone className="size-7 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No card terminal linked yet. Link a Dojo terminal in Manage to take card payments.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Label>Send to terminal</Label>
                    {terminals.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTerminalId(t.id)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                          terminalId === t.id
                            ? "border-brand bg-brand/5"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{t.label}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {t.provider} · {t.deviceId}
                          </p>
                        </div>
                        {terminalId === t.id && <Check className="size-4 text-brand" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="h-12 w-full text-base"
              disabled={
                step === "processing" ||
                (method === "cash" ? cashShort : terminals.length === 0 || terminalId == null)
              }
              onClick={submit}
            >
              {step === "processing" && <Loader2 className="size-4 animate-spin" />}
              {method === "cash"
                ? `Complete · ${formatPence(totalPence)}`
                : step === "processing"
                  ? "Waiting for terminal…"
                  : `Charge card · ${formatPence(totalPence)}`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MethodButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
        active ? "border-brand bg-brand/5 text-brand" : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

/** Sensible quick-tender buttons: exact, next round pounds, +£5, +£10, +£20. */
function quickTenderOptions(totalPence: number): number[] {
  const opts = new Set<number>()
  opts.add(totalPence)
  const nextPound = Math.ceil(totalPence / 100) * 100
  opts.add(nextPound)
  for (const note of [500, 1000, 2000, 5000]) {
    const rounded = Math.ceil(totalPence / note) * note
    opts.add(rounded)
  }
  return Array.from(opts)
    .filter((v) => v >= totalPence)
    .sort((a, b) => a - b)
    .slice(0, 5)
}
