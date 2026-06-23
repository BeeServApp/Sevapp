"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import {
  GripVertical,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Check,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  resolveLayout,
  type DashboardLayout,
} from "@/lib/dashboard-sections"
import { saveDashboardLayout } from "@/app/actions/company"

export interface DashboardSection {
  id: string
  label: string
  hint: string
  node: ReactNode
}

export function DashboardGrid({
  sections,
  initialLayout,
}: {
  sections: DashboardSection[]
  initialLayout: DashboardLayout
}) {
  const availableIds = useMemo(() => sections.map((s) => s.id), [sections])
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])

  const resolved = useMemo(
    () => resolveLayout(initialLayout, availableIds),
    [initialLayout, availableIds],
  )

  const [order, setOrder] = useState<string[]>(resolved.orderedIds)
  const [hidden, setHidden] = useState<Set<string>>(resolved.hidden)
  const [editing, setEditing] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isSaving, startSaving] = useTransition()

  function persist(nextOrder: string[], nextHidden: Set<string>) {
    setSaved(false)
    startSaving(async () => {
      await saveDashboardLayout({ order: nextOrder, hidden: [...nextHidden] })
      setSaved(true)
    })
  }

  function move(id: string, dir: -1 | 1) {
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
    persist(next, hidden)
  }

  function reorderByDrop(targetId: string) {
    if (!dragId || dragId === targetId) return
    const from = order.indexOf(dragId)
    const to = order.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    setOrder(next)
    persist(next, hidden)
  }

  function toggleHidden(id: string) {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden(next)
    persist(order, next)
  }

  function reset() {
    const next = [...availableIds]
    const cleared = new Set<string>()
    setOrder(next)
    setHidden(cleared)
    persist(next, cleared)
  }

  const visibleOrder = order.filter((id) => byId.has(id))
  const hiddenCount = visibleOrder.filter((id) => hidden.has(id)).length

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        {editing && (
          <>
            <span className="mr-auto text-sm text-muted-foreground" aria-live="polite">
              {isSaving ? "Saving…" : saved ? "Layout saved" : "Drag to reorder, toggle to hide"}
            </span>
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </>
        )}
        <Button
          variant={editing ? "default" : "outline"}
          size="sm"
          onClick={() => setEditing((e) => !e)}
          className="gap-1.5"
        >
          {editing ? <Check className="size-4" /> : <SlidersHorizontal className="size-4" />}
          {editing ? "Done" : "Customize"}
        </Button>
      </div>

      {!editing && hiddenCount === visibleOrder.length && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">All sections are hidden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click Customize to bring sections back to your dashboard.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {visibleOrder.map((id) => {
          const section = byId.get(id)!
          const isHidden = hidden.has(id)

          if (!editing) {
            if (isHidden) return null
            return <div key={id}>{section.node}</div>
          }

          return (
            <div
              key={id}
              draggable
              onDragStart={() => setDragId(id)}
              onDragEnd={() => {
                setDragId(null)
                setOverId(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (overId !== id) setOverId(id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                reorderByDrop(id)
                setOverId(null)
              }}
              className={cn(
                "rounded-lg border-2 border-dashed transition-colors",
                overId === id && dragId !== id ? "border-primary bg-primary/5" : "border-border",
                dragId === id && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{section.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{section.hint}</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => move(id, -1)}
                    aria-label={`Move ${section.label} up`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => move(id, 1)}
                    aria-label={`Move ${section.label} down`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    variant={isHidden ? "outline" : "ghost"}
                    size="icon"
                    className="size-8"
                    onClick={() => toggleHidden(id)}
                    aria-label={isHidden ? `Show ${section.label}` : `Hide ${section.label}`}
                    aria-pressed={isHidden}
                  >
                    {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className={cn("p-3", isHidden && "pointer-events-none opacity-40")}>
                {section.node}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
