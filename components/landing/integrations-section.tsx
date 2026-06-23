import Image from "next/image"
import { CreditCard, Database, ImageIcon, ArrowRight } from "lucide-react"

// User-facing integrations get a full card with logo + explanation.
const featured = [
  {
    name: "Square",
    logo: "/logos/square-mono.svg",
    icon: ArrowRight,
    title: "Live till sales from Square",
    description:
      "Connect your Square account and pull takings straight into your dashboard and financials — no manual entry, no end-of-night spreadsheets.",
    points: ["Automatic daily takings", "Sales mix by category", "Reconciled against cash-ups"],
  },
  {
    name: "Stripe",
    logo: "/logos/stripe-mono.svg",
    icon: CreditCard,
    title: "Secure billing with Stripe",
    description:
      "Per-location subscriptions, free trials and card management are handled by Stripe — PCI-compliant and trusted by millions of businesses.",
    points: ["14-day free trial", "Per-location pricing", "Cancel anytime"],
  },
]

// Infrastructure / platform partners shown as a trust strip.
const platform = [
  { name: "Neon", logo: "/logos/neon-default.svg", caption: "Postgres database", icon: Database },
  { name: "Vercel Blob", logo: "/logos/vercel-mono.svg", caption: "Asset photo storage", icon: ImageIcon },
]

export function IntegrationsSection() {
  return (
    <section id="integrations" className="border-t border-border bg-muted/20 py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand">Integrations</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Connected to the tools you already use
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground">
            Beeserv plugs into your point of sale and payment provider, and runs on a fast,
            secure cloud platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {featured.map((item) => (
            <div
              key={item.name}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-7"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 items-center justify-center rounded-lg bg-accent/40 px-3 ring-1 ring-border">
                  <Image
                    src={item.logo || "/placeholder.svg"}
                    alt={`${item.name} logo`}
                    width={22}
                    height={22}
                    className="h-5 w-auto"
                  />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{item.name}</span>
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
              <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5">
                {item.points.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 text-xs text-foreground">
                    <span className="size-1.5 rounded-full bg-brand" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-x-10 gap-y-4 rounded-2xl border border-border bg-card px-6 py-5 sm:flex-row">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Built on
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {platform.map((p) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <Image
                  src={p.logo || "/placeholder.svg"}
                  alt={`${p.name} logo`}
                  width={20}
                  height={20}
                  className="h-5 w-auto"
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.caption}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
