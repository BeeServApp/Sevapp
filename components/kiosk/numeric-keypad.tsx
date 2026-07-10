"use client"

import { Delete } from "lucide-react"
import { cn } from "@/lib/utils"

interface NumericKeypadProps {
  onDigit: (d: string) => void
  onBackspace: () => void
  onClear?: () => void
  className?: string
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

export function NumericKeypad({ onDigit, onBackspace, onClear, className }: NumericKeypadProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onDigit(k)}
          className="flex h-20 items-center justify-center rounded-2xl bg-card text-3xl font-semibold text-card-foreground shadow-sm ring-1 ring-border transition active:scale-95 active:bg-secondary"
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onClear?.()}
        className="flex h-20 items-center justify-center rounded-2xl bg-secondary text-lg font-semibold text-secondary-foreground ring-1 ring-border transition active:scale-95"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={() => onDigit("0")}
        className="flex h-20 items-center justify-center rounded-2xl bg-card text-3xl font-semibold text-card-foreground shadow-sm ring-1 ring-border transition active:scale-95 active:bg-secondary"
      >
        0
      </button>
      <button
        type="button"
        onClick={onBackspace}
        aria-label="Backspace"
        className="flex h-20 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground ring-1 ring-border transition active:scale-95"
      >
        <Delete className="size-7" />
      </button>
    </div>
  )
}

/** Row of filled/empty dots showing PIN entry progress. */
export function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "size-4 rounded-full ring-1 ring-border transition",
            i < filled ? "bg-primary" : "bg-secondary",
          )}
        />
      ))}
    </div>
  )
}
