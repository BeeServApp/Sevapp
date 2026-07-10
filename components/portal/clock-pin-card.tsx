"use client"

import { useEffect, useState, useTransition } from "react"
import { KeyRound, Check, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getMyClockPinStatus, setMyClockPin } from "@/app/actions/portal"

/**
 * Lets an employee set/change/clear their own 4-digit kiosk clock-in PIN, used
 * to clock in and out on their venue's iPad kiosk.
 */
export function ClockPinCard({ staffMemberId }: { staffMemberId: number | null }) {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (staffMemberId == null) {
      setHasPin(false)
      return
    }
    getMyClockPinStatus()
      .then((s) => setHasPin(s.hasPin))
      .catch(() => setHasPin(false))
  }, [staffMemberId])

  // Not linked to a staff profile — nothing to configure.
  if (staffMemberId == null) return null

  function save(clear = false) {
    setError(null)
    setSaved(false)
    const value = clear ? "" : pin
    if (!clear && !/^\d{4}$/.test(value)) {
      setError("Enter exactly 4 digits.")
      return
    }
    startTransition(async () => {
      try {
        await setMyClockPin(value)
        setHasPin(!clear)
        setPin("")
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your PIN.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" /> Kiosk clock-in PIN
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {hasPin
            ? "You have a PIN set. Enter a new one below to change it, or remove it."
            : "Set a 4-digit PIN to clock in and out on the venue iPad."}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            placeholder={hasPin ? "New PIN" : "e.g. 4821"}
            aria-label="Clock-in PIN"
            className="max-w-[140px] font-mono text-lg tracking-[0.4em]"
          />
          <Button onClick={() => save(false)} disabled={pending || pin.length !== 4}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <Check className="size-4" />
            ) : null}
            {saved ? "Saved" : hasPin ? "Update PIN" : "Set PIN"}
          </Button>
          {hasPin && (
            <Button variant="ghost" onClick={() => save(true)} disabled={pending}>
              Remove
            </Button>
          )}
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
