import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck, AlertTriangle, FileWarning, CheckCircle2, ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { guardOwnerPage } from "@/lib/session"
import { getGroupComplianceSummary } from "@/app/actions/group"

export const metadata: Metadata = {
  title: "Group compliance — Beeserv",
}

function pctTone(pct: number) {
  if (pct >= 90) return "text-chart-2"
  if (pct >= 70) return "text-chart-4"
  return "text-destructive"
}

export default async function GroupCompliancePage() {
  await guardOwnerPage()
  const summary = await getGroupComplianceSummary()

  const stats = [
    {
      label: "Group compliance",
      value: `${summary.compliancePct}%`,
      icon: ShieldCheck,
      tone: pctTone(summary.compliancePct),
    },
    {
      label: "Checks complete",
      value: `${summary.checksComplete}/${summary.checksTotal}`,
      icon: CheckCircle2,
      tone: "text-foreground",
    },
    {
      label: "Checks overdue",
      value: String(summary.checksOverdue),
      icon: AlertTriangle,
      tone: summary.checksOverdue > 0 ? "text-destructive" : "text-foreground",
    },
    {
      label: "Certs expiring",
      value: String(summary.certsExpiring),
      icon: FileWarning,
      tone: summary.certsExpiring > 0 ? "text-chart-4" : "text-foreground",
    },
  ]

  return (
    <>
      <PageHeader
        title="Group compliance"
        description="Certificate and check status across every venue."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="gap-0 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
              </div>
              <p className={cn("mt-2 text-3xl font-semibold tracking-tight tabular-nums", s.tone)}>
                {s.value}
              </p>
            </Card>
          )
        })}
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Compliance by venue</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Lowest-scoring venues first so gaps surface quickly
            </p>
          </CardHeader>
          <CardContent>
            {summary.venues.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No venues yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-medium">Venue</th>
                      <th className="pb-2 text-right font-medium">Compliance</th>
                      <th className="pb-2 text-right font-medium">Checks done</th>
                      <th className="pb-2 text-right font-medium">Overdue</th>
                      <th className="pb-2 text-right font-medium">Certs expiring</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.venues.map((v) => (
                      <tr key={v.venueId} className="hover:bg-secondary/50">
                        <td className="py-3">
                          <p className="font-medium text-foreground">{v.name}</p>
                          <p className="text-xs text-muted-foreground">{v.location}</p>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              pctTone(v.compliancePct),
                            )}
                          >
                            {v.compliancePct}%
                          </span>
                        </td>
                        <td className="py-3 text-right tabular-nums text-muted-foreground">
                          {v.checksComplete}/{v.checksTotal}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          <span className={v.checksOverdue > 0 ? "text-destructive" : "text-muted-foreground"}>
                            {v.checksOverdue}
                          </span>
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          <span className={v.certsExpiring > 0 ? "text-chart-4" : "text-muted-foreground"}>
                            {v.certsExpiring}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-center">
        <Link
          href="/compliance"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}
        >
          <ArrowLeft className="size-4" /> Back to venue compliance
        </Link>
      </div>
    </>
  )
}
