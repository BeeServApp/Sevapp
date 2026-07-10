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
import { ModuleInstallButton } from "@/components/marketplace/module-install-button"
import { getModuleDef } from "@/lib/modules"

const SUPPORT_EMAIL = "support@thebeesgroup.co.uk"

type MarketplaceModule = {
  id: string
  name: string
  tagline: string
  description: string
  icon: LucideIcon
  points: string[]
  /** Available to install now (vs. "coming soon"). */
  installable: boolean
}

// Beeserv's own first-party modules.
const OWN_MODULES: MarketplaceModule[] = [
  {
    id: "epos",
    name: "Beeserv EPOS",
    tagline: "Point of sale, built in",
    description:
      "A fast, hospitality-first till for pubs and restaurants — take orders, tender cash or card, and print receipts on any iPad.",
    icon: Monitor,
    points: ["Order-taking till", "Menu & product management", "Linked card terminals"],
    installable: true,
  },
  {
    id: "payments",
    name: "Beeserv Payments",
    tagline: "Take payments anywhere",
    description:
      "Card, tap and online payments with transparent pricing and next-day settlement — reconciled automatically.",
    icon: CreditCard,
    points: ["Card & contactless", "Next-day settlement", "Auto reconciliation"],
    installable: false,
  },
  {
    id: "accountancy",
    name: "Beeserv Accountancy",
    tagline: "Books that keep themselves",
    description:
      "Sales, wages and supplier costs flow into tidy, real-time accounts your accountant will actually thank you for.",
    icon: Calculator,
    points: ["Real-time P&L", "Wage & cost sync", "Export to your accountant"],
    installable: false,
  },
]

function ModuleCard({
  module: m,
  installed,
  canManage,
}: {
  module: MarketplaceModule
  installed: boolean
  canManage: boolean
}) {
  const Icon = m.icon
  const openHref = getModuleDef(m.id)?.path ?? "/marketplace"
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="size-5" />
          </div>
          {m.installable ? (
            installed ? (
              <Badge className="shrink-0 bg-brand text-brand-foreground">Installed</Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                Add-on
              </Badge>
            )
          ) : (
            <Badge variant="secondary" className="shrink-0">
              Coming soon
            </Badge>
          )}
        </div>
        <CardTitle className="mt-3 text-lg">{m.name}</CardTitle>
        <p className="text-sm font-medium text-brand">{m.tagline}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{m.description}</p>
        <ul className="flex flex-col gap-2">
          {m.points.map((point) => (
            <li key={point} className="flex items-center gap-2 text-sm text-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-2">
          {m.installable ? (
            <ModuleInstallButton
              moduleId={m.id}
              installed={installed}
              canManage={canManage}
              openHref={openHref}
            />
          ) : (
            <Button variant="secondary" className="w-full" disabled>
              Coming soon
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MarketplaceView({
  installedModuleIds,
  canManage,
}: {
  installedModuleIds: string[]
  canManage: boolean
}) {
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

      {/* Hero */}
      <Card className="overflow-hidden border-brand/20 bg-brand/5">
        <CardContent className="flex flex-col items-start gap-4 py-8 text-center sm:items-center">
          <Badge className="gap-1.5 bg-brand text-brand-foreground">
            <Sparkles className="size-3.5" />
            Beeserv EPOS is live
          </Badge>
          <div className="flex flex-col gap-2 sm:items-center">
            <h2 className="text-balance text-xl font-semibold text-foreground sm:text-2xl">
              Add a full point-of-sale to your pub in one click
            </h2>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
              Install Beeserv EPOS to run an iPad till with menu management and linked card terminals.
              Payments and Accountancy modules are on the way — plus the ability to create your own and
              connect any integration your business relies on.
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
            <ModuleCard
              key={m.id}
              module={m}
              installed={installedModuleIds.includes(m.id)}
              canManage={canManage}
            />
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
