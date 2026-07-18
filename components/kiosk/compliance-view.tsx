"use client"

import { useEffect, useState } from "react"
import { FileCheck2, Flame, Loader2, ScrollText, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getKioskCompliance,
  type KioskCompliancePayload,
  type KioskComplianceRecord,
} from "@/app/actions/kiosk"

type Tab = "licensing" | "fire"

function statusTone(status: string): string {
  const s = status.toLowerCase()
  if (s === "complete" || s === "valid") return "bg-status-ok/15 text-status-ok"
  if (s === "due" || s === "expiring") return "bg-status-near/15 text-status-near"
  if (s === "overdue" || s === "expired") return "bg-destructive/15 text-destructive"
  return "bg-secondary text-secondary-foreground"
}

function RecordCard({ record }: { record: KioskComplianceRecord }) {
  return (
    <li className="rounded-2xl bg-secondary/50 p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{record.name}</p>
          {record.reference && <p className="text-sm text-muted-foreground">Ref: {record.reference}</p>}
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", statusTone(record.status))}>
          {record.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <span className="text-muted-foreground">Frequency</span>
        <span className="text-right font-medium text-foreground">{record.frequency}</span>
        <span className="text-muted-foreground">Last done</span>
        <span className="text-right font-medium text-foreground">{record.lastDone ?? "—"}</span>
        <span className="text-muted-foreground">Next due</span>
        <span className="text-right font-medium text-foreground">{record.nextDue ?? "—"}</span>
        {record.owner && (
          <>
            <span className="text-muted-foreground">Responsible</span>
            <span className="text-right font-medium text-foreground">{record.owner}</span>
          </>
        )}
      </div>
      {record.notes && <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">{record.notes}</p>}
    </li>
  )
}

export function ComplianceView() {
  const [data, setData] = useState<KioskCompliancePayload | null>(null)
  const [tab, setTab] = useState<Tab>("licensing")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getKioskCompliance()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const records = tab === "licensing" ? data?.licensing ?? [] : data?.fire ?? []

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold">Compliance</h1>
        <span className="ml-1 text-sm text-muted-foreground">Live records for inspection</span>
      </div>

      {/* Tabs */}
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("licensing")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold transition active:scale-[0.98]",
            tab === "licensing" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          <ScrollText className="size-5" /> Licensing
        </button>
        <button
          type="button"
          onClick={() => setTab("fire")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold transition active:scale-[0.98]",
            tab === "fire" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          <Flame className="size-5" /> Fire safety
        </button>
      </div>

      {/* Records */}
      {records.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">
            No {tab === "licensing" ? "licensing" : "fire safety"} records have been added yet.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {records.map((r) => (
            <RecordCard key={r.id} record={r} />
          ))}
        </ul>
      )}

      {/* Relevant certificates */}
      {data && data.certificates.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <FileCheck2 className="size-4" /> Certificates on file
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.certificates.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3 ring-1 ring-border"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.authority ? `${c.authority} · ` : ""}Expires {c.expires ?? "—"}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", statusTone(c.status))}>
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
