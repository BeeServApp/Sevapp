import { cn } from "@/lib/utils"
import { statusColorVar, statusLabel, type TargetStatus } from "@/lib/budget"

export function TargetStatusDot({
  status,
  size = "md",
  withLabel = false,
  className,
}: {
  status: TargetStatus | null
  size?: "sm" | "md"
  withLabel?: boolean
  className?: string
}) {
  if (!status) return null

  const dotSize = size === "sm" ? "size-2" : "size-2.5"
  const label = statusLabel(status)

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={label}>
      <span
        className={cn("inline-block shrink-0 rounded-full", dotSize)}
        style={{ backgroundColor: statusColorVar(status) }}
        aria-hidden
      />
      {withLabel ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  )
}
