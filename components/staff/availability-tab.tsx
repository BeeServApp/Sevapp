"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { setAvailability } from "@/app/actions/scheduling"
import type { DbStaffMember, DbAvailability } from "@/lib/db/schema"

type Status = "available" | "preferred" | "unavailable"

const CYCLE: Status[] = ["available", "preferred", "unavailable"]

const STATUS_STYLE: Record<Status, { cell: string; label: string }> = {
  available: { cell: "bg-card hover:bg-accent text-muted-foreground", label: "Available" },
  preferred: { cell: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100", label: "Prefers" },
  unavailable: { cell: "bg-rose-50 text-rose-700 hover:bg-rose-100", label: "Off" },
}

interface Props {
  venueId: number
  rotaDays: string[]
  staff: DbStaffMember[]
  initialAvailability: DbAvailability[]
}

export function AvailabilityTab({ venueId, rotaDays, staff, initialAvailability }: Props) {
  const [rows, setRows] = useState<DbAvailability[]>(initialAvailability)

  function statusFor(staffMemberId: number, day: string): Status {
    const r = rows.find((a) => a.staffMemberId === staffMemberId && a.day === day)
    return (r?.status as Status) ?? "available"
  }

  function cycle(staffMemberId: number, day: string) {
    const current = statusFor(staffMemberId, day)
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
    // Optimistic update
    setRows((prev) => {
      const without = prev.filter((a) => !(a.staffMemberId === staffMemberId && a.day === day))
      return [
        ...without,
        {
          id: -Date.now(),
          userId: "",
          venueId,
          staffMemberId,
          day,
          status: next,
          startTime: null,
          endTime: null,
          note: null,
          createdAt: new Date(),
        } as DbAvailability,
      ]
    })
    void setAvailability({ venueId, staffMemberId, day, status: next }).then((saved) => {
      setRows((prev) => {
        const without = prev.filter((a) => !(a.staffMemberId === staffMemberId && a.day === day))
        return [...without, saved]
      })
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team availability</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap a cell to cycle availability. Staff can also set their own from the app. This overlays onto the rota
          so you can avoid scheduling people when they&apos;re off.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {(["available", "preferred", "unavailable"] as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded", STATUS_STYLE[s].cell.split(" ")[0])} />
              {STATUS_STYLE[s].label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {staff.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Add staff members first.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-border bg-muted/40">
                <th className="sticky left-0 z-10 w-44 bg-muted/40 px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Team member
                </th>
                {rotaDays.map((d) => (
                  <th key={d} className="border-l border-border px-3 py-2.5 text-center font-medium text-muted-foreground">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium whitespace-nowrap">{s.name}</td>
                  {rotaDays.map((day) => {
                    const st = statusFor(s.id, day)
                    return (
                      <td key={day} className="border-l border-border p-1 text-center">
                        <button
                          type="button"
                          onClick={() => cycle(s.id, day)}
                          className={cn(
                            "w-full rounded-md px-2 py-2 text-xs font-medium transition-colors",
                            STATUS_STYLE[st].cell,
                          )}
                        >
                          {STATUS_STYLE[st].label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
