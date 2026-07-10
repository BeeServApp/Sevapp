"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { getKioskMaintenance, logKioskMaintenance } from "@/app/actions/kiosk"

type MaintenanceRow = Awaited<ReturnType<typeof getKioskMaintenance>>[number]

const PRIORITIES = ["Low", "Medium", "High"] as const

export function MaintenanceView() {
  const [rows, setRows] = useState<MaintenanceRow[]>([])
  const [assetName, setAssetName] = useState("")
  const [issue, setIssue] = useState("")
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Medium")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setRows(await getKioskMaintenance())
  }
  useEffect(() => {
    load()
  }, [])

  async function submit() {
    if (!assetName.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await logKioskMaintenance({ assetName, issue, priority })
      setAssetName("")
      setIssue("")
      setPriority("Medium")
      setDone(true)
      setTimeout(() => setDone(false), 2500)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
      {/* Log form */}
      <div className="rounded-3xl bg-card p-6 ring-1 ring-border">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold">
          <Wrench className="size-6 text-primary" /> Log maintenance
        </h1>
        <p className="mb-5 text-sm text-muted-foreground">Report anything broken or needing attention.</p>

        <label className="mb-1 block text-sm font-medium">What needs attention?</label>
        <input
          value={assetName}
          onChange={(e) => setAssetName(e.target.value)}
          placeholder="e.g. Ice machine, Cellar door"
          className="mb-4 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mb-1 block text-sm font-medium">Details (optional)</label>
        <textarea
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          rows={3}
          placeholder="Describe the issue…"
          className="mb-4 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mb-2 block text-sm font-medium">Priority</label>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "rounded-xl py-3 font-semibold transition active:scale-95",
                priority === p ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={!assetName.trim() || busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : done ? <CheckCircle2 className="size-5" /> : null}
          {done ? "Logged" : "Log maintenance"}
        </button>
      </div>

      {/* Recent log */}
      <div className="rounded-3xl bg-card p-6 ring-1 ring-border">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Recent</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3">
                <span
                  className={cn(
                    "mt-1 size-2.5 shrink-0 rounded-full",
                    r.priority === "High" ? "bg-destructive" : r.priority === "Medium" ? "bg-status-near" : "bg-muted-foreground",
                  )}
                />
                <div className="min-w-0">
                  <div className="font-medium">{r.assetName}</div>
                  {r.issue && <div className="text-sm text-muted-foreground">{r.issue}</div>}
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r.loggedDate} · {r.status}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
