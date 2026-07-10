"use client"

import { cn } from "@/lib/utils"

interface ScoreGaugeProps {
  score: number
  size?: number
  className?: string
}

/** Circular 0–100 venue-score gauge. Colour shifts with performance band. */
export function ScoreGauge({ score, size = 220, className }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const stroke = Math.round(size * 0.09)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  const band =
    clamped >= 85
      ? "var(--color-status-on)"
      : clamped >= 60
        ? "var(--color-status-near)"
        : "var(--color-status-off)"

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={band}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 700ms ease, stroke 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-5xl font-bold leading-none text-foreground tabular-nums">{clamped}</span>
        <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Venue Score</span>
      </div>
      <span className="sr-only">{`Venue score ${clamped} out of 100`}</span>
    </div>
  )
}
