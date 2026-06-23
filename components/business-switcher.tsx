"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, ChevronDown, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBusiness, switchBusiness, type BusinessSummary } from "@/app/actions/business"

export function BusinessSwitcher({ businesses }: { businesses: BusinessSummary[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")

  const active = businesses.find((b) => b.active) ?? businesses[0] ?? null

  function handleSwitch(scopeId: string) {
    if (scopeId === active?.scopeId) return
    startTransition(async () => {
      await switchBusiness(scopeId)
      router.refresh()
    })
  }

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    const fd = new FormData()
    fd.set("name", trimmed)
    startTransition(async () => {
      await createBusiness(fd)
      setName("")
      setCreateOpen(false)
      router.refresh()
    })
  }

  // A single business doesn't need a switcher chrome, but we still allow adding more.
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary disabled:opacity-60"
              disabled={pending}
              aria-label="Switch business"
            />
          }
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Building2 className="size-4" />
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold text-foreground">{active?.name ?? "My business"}</p>
            <p className="text-xs text-muted-foreground">
              {businesses.length > 1 ? `${businesses.length} businesses` : "Business"}
            </p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Switch business</DropdownMenuLabel>
          </DropdownMenuGroup>
          {businesses.map((b) => (
            <DropdownMenuItem key={b.scopeId} onClick={() => handleSwitch(b.scopeId)}>
              <Building2 className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              {b.active && <Check className="size-4 text-brand" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              setCreateOpen(true)
            }}
          >
            <Plus className="size-4" />
            Add a business
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a business</DialogTitle>
            <DialogDescription>
              Each business has its own venues, staff, and data, and starts on a 14-day free trial.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Bath Springs"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? "Creating..." : "Create business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
