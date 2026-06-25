import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Kpi } from "@/lib/mock-data"
import { TargetStatusDot } from "@/components/target-status-dot"
import { statusLabel, type TargetStatus } from "@/lib/budget"

export function StatCard({
  kpi,
  status,
  targetHint,
}: {
  kpi: Kpi
  status?: TargetStatus | null
  targetHint?: string
}) {
  const Icon =
    kpi.trend === "up" ? ArrowUpRight : kpi.trend === "down" ? ArrowDownRight : Minus
  const deltaColor =
    kpi.trend === "up"
      ? "text-chart-2"
      : kpi.trend === "down"
        ? "text-muted-foreground"
        : "text-muted-foreground"

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
        {status ? <TargetStatusDot status={status} /> : null}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {kpi.value}
      </p>
      <div className="mt-3 flex items-center gap-1.5 text-sm">
        <span className={cn("inline-flex items-center gap-0.5 font-medium", deltaColor)}>
          <Icon className="size-3.5" />
          {kpi.delta}
        </span>
        <span className="text-muted-foreground">{kpi.hint}</span>
      </div>
      {status && targetHint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {statusLabel(status)} · {targetHint}
        </p>
      ) : null}
    </Card>
  )
}
