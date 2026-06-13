import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Kpi } from "@/lib/mock-data"

export function StatCard({ kpi }: { kpi: Kpi }) {
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
      <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
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
    </Card>
  )
}
