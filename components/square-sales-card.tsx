import Link from "next/link"
import { CreditCard, ArrowRight, Link2, MapPin, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SquareSales } from "@/app/actions/square"
import { SquareSyncButton } from "@/components/square-sync-button"

function formatMoney(pence: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
  }).format(pence / 100)
}

function formatTime(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function CardShell({
  children,
  showSync = false,
}: {
  children: React.ReactNode
  showSync?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </div>
          <div>
            <CardTitle>Square sales</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">Live takings from Square, last 30 days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showSync && <SquareSyncButton scope="active" variant="outline" size="sm" />}
          <Link
            href="/settings?tab=integrations"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground")}
          >
            Manage <ArrowRight className="size-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Prompt({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: typeof Link2
  title: string
  body: string
  cta?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
      {cta && (
        <Link
          href="/settings?tab=integrations"
          className={cn(buttonVariants({ size: "sm" }), "mt-2")}
        >
          {cta}
        </Link>
      )}
    </div>
  )
}

export function SquareSalesCard({ sales }: { sales: SquareSales }) {
  // No Square app configured at all — keep the dashboard clean.
  if (sales.state === "not_configured") return null

  if (sales.state === "not_connected") {
    return (
      <CardShell>
        <Prompt
          icon={Link2}
          title="Connect Square"
          body="Link your Square account to see live sales and transactions here."
          cta="Connect Square"
        />
      </CardShell>
    )
  }

  if (sales.state === "not_mapped") {
    return (
      <CardShell>
        <Prompt
          icon={MapPin}
          title="Link this venue"
          body="Map this venue to a Square location to pull in its sales."
          cta="Set up mapping"
        />
      </CardShell>
    )
  }

  if (sales.state === "error") {
    return (
      <CardShell>
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Couldn&apos;t load Square sales</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            We&apos;ll try again shortly. Your other dashboard data is unaffected.
          </p>
        </div>
      </CardShell>
    )
  }

  return (
    <CardShell showSync>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Today" value={formatMoney(sales.todayPence, sales.currency)} />
        <Stat label="Today's txns" value={String(sales.todayCount)} />
        <Stat label="Last 30 days" value={formatMoney(sales.periodPence, sales.currency)} />
        <Stat label="30-day txns" value={String(sales.periodCount)} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Recent transactions</p>
        {sales.recent.length === 0 ? (
          <p className="rounded-lg border border-border py-6 text-center text-sm text-muted-foreground">
            No transactions in the last 30 days.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {sales.recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{formatTime(t.createdAt)}</span>
                </div>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {formatMoney(t.amountPence, t.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
