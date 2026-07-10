"use client"

import { useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { pairKioskDevice } from "@/app/actions/kiosk"

export function PairScreen({ onPaired }: { onPaired: (venueName: string) => void }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await pairKioskDevice(code)
      onPaired(res.venueName)
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 text-center shadow-sm ring-1 ring-border">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <KeyRound className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold text-balance">Pair this kiosk</h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          Enter the pairing code from Beeserv → Settings → Kiosk to link this iPad to your venue.
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit()
          }}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABC123"
          aria-label="Pairing code"
          className="mt-6 w-full rounded-2xl border border-input bg-background py-5 text-center text-4xl font-semibold tracking-[0.3em] uppercase outline-none focus:ring-2 focus:ring-ring"
        />

        {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={code.length < 4 || loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-5 text-lg font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          {loading ? "Pairing…" : "Pair device"}
        </button>
      </div>
    </main>
  )
}
