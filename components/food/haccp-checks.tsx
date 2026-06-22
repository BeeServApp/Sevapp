"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Thermometer, ClipboardCheck, Check, X, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { RowActions } from "@/components/compliance/row-actions"
import {
  createFoodCheck,
  deleteFoodCheck,
  logFoodCheck,
  seedStarterChecks,
  type FoodCheckWithLog,
} from "@/app/actions/food"
import { tenthsToTemp } from "@/lib/food"

const AREAS = [
  "Fridge",
  "Freezer",
  "Hot Hold",
  "Cooking",
  "Cooling",
  "Probe",
  "Delivery",
  "Cleaning",
  "Allergen",
  "Pest",
]
const TYPES = ["Temperature", "Visual"]
const FREQUENCIES = ["Daily", "Weekly", "Monthly"]
const TIMES = ["Opening", "Service", "Close"]

export function HaccpChecks({ venueId, checks }: { venueId: number; checks: FoodCheckWithLog[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [type, setType] = useState("Temperature")
  const [isPending, startTransition] = useTransition()
  const [seeding, startSeed] = useTransition()

  const grouped = useMemo(() => {
    const map = new Map<string, FoodCheckWithLog[]>()
    for (const c of checks) {
      const list = map.get(c.area) ?? []
      list.push(c)
      map.set(c.area, list)
    }
    return Array.from(map.entries())
  }, [checks])

  function handleCreate(formData: FormData) {
    const t = String(formData.get("type") || "Temperature")
    startTransition(async () => {
      await createFoodCheck({
        venueId,
        name: String(formData.get("name") || ""),
        area: String(formData.get("area") || "Fridge"),
        type: t,
        minTemp: t === "Temperature" ? Number(formData.get("minTemp")) : null,
        maxTemp: t === "Temperature" ? Number(formData.get("maxTemp")) : null,
        frequency: String(formData.get("frequency") || "Daily"),
        timeOfDay: String(formData.get("timeOfDay") || ""),
      })
      setCreateOpen(false)
      setType("Temperature")
    })
  }

  if (checks.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <ClipboardCheck className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">No HACCP checks yet</p>
          <p className="text-sm text-muted-foreground">
            Add the standard set of temperature and hygiene checks to get started in seconds.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => startSeed(async () => { await seedStarterChecks(venueId); router.refresh() })}
            disabled={seeding}
          >
            <Sparkles className="size-4" />
            {seeding ? "Adding…" : "Add starter checks"}
          </Button>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New check
          </Button>
        </div>
        <CreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          type={type}
          setType={setType}
          onSubmit={handleCreate}
          isPending={isPending}
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Daily HACCP checks</h2>
          <p className="text-sm text-muted-foreground">
            Log temperatures and hygiene checks. Out-of-range readings are flagged automatically.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New check
        </Button>
      </div>

      {grouped.map(([area, areaChecks]) => (
        <Card key={area}>
          <CardContent className="flex flex-col gap-1 p-0">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">{area}</h3>
              <span className="text-xs text-muted-foreground">
                {areaChecks.filter((c) => c.todayLog).length}/{areaChecks.length} logged
              </span>
            </div>
            {areaChecks.map((c) => (
              <CheckRow key={c.id} venueId={venueId} check={c} />
            ))}
          </CardContent>
        </Card>
      ))}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        type={type}
        setType={setType}
        onSubmit={handleCreate}
        isPending={isPending}
      />
    </div>
  )
}

function formatRange(min: number | null, max: number | null) {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${tenthsToTemp(min)} to ${tenthsToTemp(max)}°C`
  if (max != null) return `≤ ${tenthsToTemp(max)}°C`
  return `≥ ${tenthsToTemp(min as number)}°C`
}

function CheckRow({ venueId, check }: { venueId: number; check: FoodCheckWithLog }) {
  const router = useRouter()
  const [temp, setTemp] = useState("")
  const [corrective, setCorrective] = useState("")
  const [isPending, startTransition] = useTransition()

  const log = check.todayLog
  const isTemp = check.type === "Temperature"
  const range = formatRange(check.minTemp, check.maxTemp)
  const failed = log && !log.passed

  function submitTemp() {
    if (temp === "") return
    startTransition(async () => {
      await logFoodCheck({
        venueId,
        checkId: check.id,
        tempReading: Number(temp),
        correctiveAction: corrective,
      })
      setTemp("")
      router.refresh()
    })
  }

  function submitVisual(passed: boolean) {
    startTransition(async () => {
      await logFoodCheck({
        venueId,
        checkId: check.id,
        passed,
        correctiveAction: passed ? "" : corrective,
      })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isTemp ? (
            <Thermometer className="size-4 text-muted-foreground" />
          ) : (
            <ClipboardCheck className="size-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">{check.name}</p>
            <p className="text-xs text-muted-foreground">
              {[range, check.timeOfDay, check.frequency].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {log ? (
            <div className="flex items-center gap-2">
              {isTemp && log.tempReading != null ? (
                <span className="text-sm font-medium tabular-nums">{tenthsToTemp(log.tempReading)}°C</span>
              ) : null}
              <StatusBadge status={log.passed ? "Pass" : "Fail"} />
              <RowActions deleteAction={() => deleteFoodCheck(check.id)} deleteLabel="Delete check" />
            </div>
          ) : isTemp ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  placeholder="°C"
                  className="h-8 w-20 rounded-r-none"
                  aria-label={`Temperature for ${check.name}`}
                />
                <Button
                  size="sm"
                  className="h-8 rounded-l-none"
                  onClick={submitTemp}
                  disabled={isPending || temp === ""}
                >
                  Log
                </Button>
              </div>
              <RowActions deleteAction={() => deleteFoodCheck(check.id)} deleteLabel="Delete check" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => submitVisual(true)}
                disabled={isPending}
              >
                <Check className="size-4" />
                Pass
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => submitVisual(false)}
                disabled={isPending}
              >
                <X className="size-4" />
                Fail
              </Button>
              <RowActions deleteAction={() => deleteFoodCheck(check.id)} deleteLabel="Delete check" />
            </div>
          )}
        </div>
      </div>

      {failed ? (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {log?.correctiveAction
            ? `Corrective action: ${log.correctiveAction}`
            : "Out of safe range — record a corrective action."}
        </div>
      ) : null}

      {!log ? (
        <Input
          value={corrective}
          onChange={(e) => setCorrective(e.target.value)}
          placeholder="Corrective action (only needed if it fails)"
          className="h-8 text-xs"
          aria-label={`Corrective action for ${check.name}`}
        />
      ) : null}
    </div>
  )
}

function CreateDialog({
  open,
  onOpenChange,
  type,
  setType,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  type: string
  setType: (t: string) => void
  onSubmit: (fd: FormData) => void
  isPending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>New HACCP check</DialogTitle>
        <form action={onSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fc-name">Check name</Label>
            <Input id="fc-name" name="name" placeholder="Walk-in fridge temperature" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Area</Label>
              <Select name="area" defaultValue="Fridge">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select name="type" value={type} onValueChange={(v) => setType(v ?? "Temperature")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "Temperature" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fc-min">Min °C</Label>
                <Input id="fc-min" name="minTemp" type="number" step="0.1" placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fc-max">Max °C</Label>
                <Input id="fc-max" name="maxTemp" type="number" step="0.1" placeholder="5" />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Frequency</Label>
              <Select name="frequency" defaultValue="Daily">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Time of day</Label>
              <Select name="timeOfDay" defaultValue="Opening">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose
              render={(props) => (
                <Button {...props} type="button" variant="outline">
                  Cancel
                </Button>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add check"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
