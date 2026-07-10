"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeKioskTask, getKioskTasks } from "@/app/actions/kiosk"
import type { VenueTask } from "@/lib/kiosk-tasks"

const REFRESH_MS = 30000

function dueState(t: VenueTask, now: Date): "done" | "overdue" | "soon" | "later" {
  if (t.status === "Completed") return "done"
  if (t.dueDate && t.dueTime) {
    const [y, m, d] = t.dueDate.split("-").map(Number)
    const [hh, mm] = t.dueTime.split(":").map(Number)
    const due = new Date(y, m - 1, d, hh, mm)
    if (now > due) return "overdue"
    if (due.getTime() - now.getTime() < 60 * 60 * 1000) return "soon"
  }
  return "later"
}

export function TasksView({ onChange }: { onChange: () => void }) {
  const [tasks, setTasks] = useState<VenueTask[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const pendingPhotoTask = useRef<number | null>(null)

  async function load() {
    try {
      setTasks(await getKioskTasks())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  async function complete(taskId: number, photoUrl?: string) {
    setBusyId(taskId)
    try {
      await completeKioskTask(taskId, photoUrl)
      await load()
      onChange()
    } finally {
      setBusyId(null)
    }
  }

  function onCompleteClick(t: VenueTask) {
    if (t.requiresPhoto) {
      pendingPhotoTask.current = t.id
      fileRef.current?.click()
    } else {
      void complete(t.id)
    }
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const taskId = pendingPhotoTask.current
    e.target.value = ""
    pendingPhotoTask.current = null
    if (!file || taskId == null) return
    setBusyId(taskId)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/kiosk/upload", { method: "POST", body: form })
      const json = (await res.json()) as { url?: string; error?: string }
      await complete(taskId, json.url)
    } catch {
      setBusyId(null)
    }
  }

  const now = new Date()
  const pending = tasks.filter((t) => t.status !== "Completed")
  const done = tasks.filter((t) => t.status === "Completed")

  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhotoSelected} />

      <h1 className="mb-1 text-2xl font-semibold">Today&apos;s tasks</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {pending.length} to do · {done.length} done
      </p>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No tasks scheduled for today.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...pending, ...done].map((t) => {
            const st = dueState(t, now)
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border",
                  st === "overdue" && "ring-2 ring-destructive",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-lg font-medium",
                      t.status === "Completed" && "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{t.category}</span>
                    {t.dueTime && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          st === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground",
                        )}
                      >
                        <Clock className="size-3" />
                        {t.dueTime}
                        {st === "overdue" && " · overdue"}
                      </span>
                    )}
                    {t.requiresPhoto && t.status !== "Completed" && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Camera className="size-3" /> photo
                      </span>
                    )}
                    {t.status === "Completed" && t.completedBy && (
                      <span className="text-muted-foreground">by {t.completedBy}</span>
                    )}
                  </div>
                </div>

                {t.status === "Completed" ? (
                  <CheckCircle2 className="size-7 shrink-0 text-primary" />
                ) : (
                  <button
                    type="button"
                    onClick={() => onCompleteClick(t)}
                    disabled={busyId === t.id}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-50"
                  >
                    {busyId === t.id ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : t.requiresPhoto ? (
                      <Camera className="size-5" />
                    ) : (
                      <CheckCircle2 className="size-5" />
                    )}
                    Done
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
