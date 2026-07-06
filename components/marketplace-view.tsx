import Link from "next/link"
import {
  Store,
  Monitor,
  CreditCard,
  Calculator,
  Blocks,
  Mail,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const SUPPORT_EMAIL = "support@thebeesgroup.co.uk"

type MarketplaceModule = {
  name: string
  tagline: string
  description: string
  icon: LucideIcon
  points: string[]
}

// Beeserv's own first-party modules, launching soon.
const OWN_MODULES: MarketplaceModule[] = [
  {
    name: "Beeserv EPOS",
    tagline: "Point of sale, built in",
    description:
      "A fast, hospitality-first till that syncs sales, menus and stock straight into the modules you already use.",
    icon: Monitor,
    points: ["Live sales into your dashboard", "Menu & stock sync", "Works offline"],
  },
  {
    name: "Beeserv Payments",
    tagline: "Take payments anywhere",
    description:
      "Card, tap and online payments with transparent pricing and next-day settlement — reconciled automatically.",
    icon: CreditCard,
    points: ["Card & contactless", "Next-day settlement", "Auto reconciliation"],
  },
  {
    name: "Beeserv Accountancy",
    tagline: "Books that keep themselves",
    description:
      "Sales, wages and supplier costs flow into tidy, real-time accounts your accountant will actually thank you for.",
    icon: Calculator,
    points: ["Real-time P&L", "Wage & cost sync", "Export to your accountant"],
  },
]

function ModuleCard({ module: m }: { module: MarketplaceModule }) {
  const Icon = m.icon
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="size-5" />
          </div>
          <Badge variant="secondary" className="shrink-0">
            Coming soon
          </Badge>
        </div>
        <CardTitle className="mt-3 text-lg">{m.name}</CardTitle>
        <p className="text-sm font-medium text-brand">{m.tagline}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{m.description}</p>
        <ul className="mt-auto flex flex-col gap-2">
          {m.points.map((point) => (
            <li key={point} className="flex items-center gap-2 text-sm text-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function MarketplaceView() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Store className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Marketplace</h1>
        </div>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          One connected platform for your whole operation. Add Beeserv&apos;s own modules or plug in the
          tools you already love — all talking to each other, all in one place.
        </p>
      </div>

      {/* Coming soon hero */}
      <Card className="overflow-hidden border-brand/20 bg-brand/5">
        <CardContent className="flex flex-col items-start gap-4 py-8 text-center sm:items-center">
          <Badge className="gap-1.5 bg-brand text-brand-foreground">
            <Sparkles className="size-3.5" />
            Coming soon
          </Badge>
          <div className="flex flex-col gap-2 sm:items-center">
            <h2 className="text-balance text-xl font-semibold text-foreground sm:text-2xl">
              The Beeserv Marketplace is on its way
            </h2>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
              We&apos;re building first-party EPOS, Payments and Accountancy modules — plus the ability to
              create your own and connect any integration your business relies on.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Own modules */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Our own modules</h2>
          <p className="text-sm text-muted-foreground">
            Purpose-built by Beeserv and designed to work seamlessly together.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OWN_MODULES.map((m) => (
            <ModuleCard key={m.name} module={m} />
          ))}
        </div>
      </section>

      {/* Build your own + contact */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Blocks className="size-5" />
            </div>
            <CardTitle className="mt-3 text-lg">Create your own modules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Build bespoke modules and integrations tailored to how your business actually runs — extending
              Beeserv with your own workflows, data and tools.
            </p>
            <Badge variant="secondary" className="w-fit">
              Coming soon
            </Badge>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Mail className="size-5" />
            </div>
            <CardTitle className="mt-3 text-lg">Want to add an integration?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Using a tool you&apos;d love to see in Beeserv? Tell us what you need and we&apos;ll work with you
              to bring it to the marketplace.
            </p>
            <Button className="mt-auto w-fit" render={<Link href={`mailto:${SUPPORT_EMAIL}?subject=Marketplace integration request`} />}>
              <Mail className="size-4" />
              Contact us
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
