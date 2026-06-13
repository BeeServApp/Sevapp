import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Tone = "success" | "warning" | "danger" | "info" | "neutral"

const toneMap: Record<string, Tone> = {
  // positive / done
  Delivered: "success",
  Confirmed: "success",
  Resolved: "success",
  Paid: "success",
  Approved: "success",
  Complete: "success",
  Valid: "success",
  "On shift": "success",
  // in-progress / info
  "In progress": "info",
  Submitted: "info",
  Provisional: "info",
  "Full-time": "info",
  // attention / warning
  Pending: "warning",
  Due: "warning",
  Enquiry: "warning",
  Expiring: "warning",
  "On leave": "warning",
  Draft: "neutral",
  // negative
  Overdue: "danger",
  Declined: "danger",
  Expired: "danger",
}

const toneClasses: Record<Tone, string> = {
  success: "border-transparent bg-chart-2/15 text-chart-2",
  warning: "border-transparent bg-chart-4/20 text-[oklch(0.45_0.11_70)]",
  danger: "border-transparent bg-destructive/12 text-destructive",
  info: "border-transparent bg-chart-3/15 text-chart-3",
  neutral: "border-transparent bg-muted text-muted-foreground",
}

export function StatusBadge({ status }: { status: string }) {
  const tone = toneMap[status] ?? "neutral"
  return (
    <Badge variant="outline" className={cn("font-medium", toneClasses[tone])}>
      {status}
    </Badge>
  )
}
