"use client"

import { useMemo, useState, useTransition } from "react"
import { Droplets, Flame, Gauge, Loader2, Plus, Trash2, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createMeterReading, deleteMeterReading } from "@/app/actions/oversight"
import type { DbMeterReading } from "@/lib/db/schema"

const METER_TYPES = [
  { type: "Electric", unit: "kWh", icon: Zap, tone: "text-chart-4" },
  { type: "Gas", unit: "m³", icon: Flame, tone: "text-destructive" },
  { type: "Water", unit: "m³", icon: Droplets, tone: "text-chart-3" },
] as const

function meterMeta(type: string) {
  return METER_TYPES.find((m) => m.type === type) ?? { type, unit: "", icon: Gauge, tone: "text-muted-foreground" }
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function MeterReadingsPanel({
  venueId,
  initialReadings,
}: {
  venueId: number
  initialReadings: DbMeterReading[]
}) {
  const [readings, setReadings] = useState<DbMeterReading[]>(initialReadings)

  const latest = useMemo(() => {
    const map = new Map<string, DbMeterReading>()
    for (const r of readings) {
      const cur = map.get(r.meterType)
      if (!cur || (r.readingDate ?? "") > (cur.readingDate ?? "")) map.set(r.meterType, r)
    }
    return map
  }, [readings])

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {METER_TYPES.map(({ type, unit, icon: Icon, tone }) => {
          const r = latest.get(type)
          return (
            <Card key={type} className="flex-row items-center gap-3 p-4">
              <div className={cn("flex size-10 items-center justify-center rounded-md bg-muted", tone)}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {r ? `${r.value.toLocaleString()} ${unit}` : "—"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {type}
                  {r?.readingDate ? ` · ${fmtDate(r.readingDate)}` : " · No readings"}
                </p>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <CreateReadingDialog venueId={venueId} onCreated={(r) => setReadings((prev) => [r, ...prev])} />
      </div>

      {readings.length === 0 ? (
        <Card className="items-center gap-2 border-dashed py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Gauge className="size-5" />
          </div>
          <p className="font-medium text-foreground">No meter readings yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Record gas, electric and water readings to track usage over time.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {readings.map((r) => {
              const meta = meterMeta(r.meterType)
              const Icon = meta.icon
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md bg-muted", meta.tone)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {r.value.toLocaleString()} {r.unit}
                      <Badge variant="outline" className="ml-2 border-transparent bg-muted text-xs text-muted-foreground">
                        {r.meterType}
                      </Badge>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[fmtDate(r.readingDate), r.recordedBy, r.notes].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <DeleteButton id={r.id} onDeleted={(id) => setReadings((prev) => prev.filter((x) => x.id !== id))} />
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

function DeleteButton({ id, onDeleted }: { id: number; onDeleted: (id: number) => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        onDeleted(id)
        startTransition(() => deleteMeterReading(id))
      }}
      aria-label="Delete reading"
    >
      <Trash2 className="size-4" />
    </Button>
  )
}

function CreateReadingDialog({
  venueId,
  onCreated,
}: {
  venueId: number
  onCreated: (r: DbMeterReading) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [meterType, setMeterType] = useState<string>("Electric")
  const [unit, setUnit] = useState<string>("kWh")
  const [value, setValue] = useState("")
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10))
  const [recordedBy, setRecordedBy] = useState("")
  const [notes, setNotes] = useState("")

  function pickType(t: string) {
    setMeterType(t)
    const meta = meterMeta(t)
    setUnit(meta.unit)
  }

  function reset() {
    setMeterType("Electric")
    setUnit("kWh")
    setValue("")
    setReadingDate(new Date().toISOString().slice(0, 10))
    setRecordedBy("")
    setNotes("")
    setError(null)
  }

  function submit() {
    const num = Number.parseFloat(value)
    if (Number.isNaN(num)) {
      setError("Enter a valid reading value")
      return
    }
    startTransition(async () => {
      try {
        const created = await createMeterReading({
          venueId,
          meterType,
          unit: unit.trim() || "",
          value: num,
          readingDate,
          recordedBy: recordedBy.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        onCreated(created)
        reset()
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save reading")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Record reading
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record meter reading</DialogTitle>
          <DialogDescription>Log a utility meter reading for this venue.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Meter</Label>
              <Select value={meterType} onValueChange={(v) => pickType(v ?? "Electric")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METER_TYPES.map((m) => (
                    <SelectItem key={m.type} value={m.type}>
                      {m.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mr-unit">Unit</Label>
              <Input id="mr-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. kWh" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mr-value">Reading</Label>
              <Input
                id="mr-value"
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. 48213"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mr-date">Date</Label>
              <Input id="mr-date" type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mr-by">Recorded by</Label>
            <Input
              id="mr-by"
              value={recordedBy}
              onChange={(e) => setRecordedBy(e.target.value)}
              placeholder="Who took the reading?"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mr-notes">Notes</Label>
            <Textarea id="mr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save reading
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
