"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useVenue } from "@/components/venue-provider"
import { globalSearch, type SearchGroup, type SearchResult } from "@/app/actions/search"
import { cn } from "@/lib/utils"

const GROUP_ORDER: SearchGroup[] = [
  "Orders",
  "Suppliers",
  "Staff",
  "Tasks",
  "Assets",
  "Events",
  "Maintenance",
]

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const { activeVenue } = useVenue()
  const venueId = activeVenue?.id ?? null

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search whenever the query changes.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || venueId == null) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await globalSearch(venueId, q)
        if (!cancelled) {
          setResults(res)
          setActiveIndex(0)
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, venueId])

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<SearchGroup, SearchResult[]>()
    for (const r of results) {
      const list = map.get(r.group) ?? []
      list.push(r)
      map.set(r.group, list)
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }))
  }, [results])

  // Flat list mirrors visual order, used for keyboard navigation.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  function go(result: SearchResult) {
    setOpen(false)
    setQuery("")
    setResults([])
    router.push(result.href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      const target = flat[activeIndex]
      if (target) {
        e.preventDefault()
        go(target)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const q = query.trim()
  const showDropdown = open && q.length >= 2
  let runningIndex = -1

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search orders, staff, tasks..."
        className="bg-background pl-9 pr-9"
        aria-label="Search across your venue"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="global-search-results"
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("")
            setResults([])
          }}
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}

      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </div>
          ) : flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches for <span className="font-medium text-foreground">{q}</span>
            </div>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto py-1">
              {grouped.map(({ group, items }) => (
                <div key={group}>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  {items.map((item) => {
                    runningIndex += 1
                    const isActive = runningIndex === activeIndex
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActiveIndex(flat.indexOf(item))}
                        onClick={() => go(item)}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
                          isActive ? "bg-secondary" : "hover:bg-secondary/60",
                        )}
                      >
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
