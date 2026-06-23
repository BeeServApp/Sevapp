import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"
import {
  ClipboardList,
  Wallet,
  Users,
  ShieldCheck,
  Package,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  CalendarClock,
  Smartphone,
  CreditCard,
  Sparkles,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { PricingSection } from "@/components/pricing-section"
import { ScreenshotFrame } from "@/components/landing/screenshot-frame"
import { IntegrationsSection } from "@/components/landing/integrations-section"
import { cn } from "@/lib/utils"
import { getCurrentUser, getSession } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function LandingPage() {
  const session = await getSession()
  if (session?.user) {
    const me = await getCurrentUser()
    redirect(me.appRole === "staff" ? "/staff" : "/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center">
            <BrandLogo className="h-12 md:h-14" priority />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#modules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Product
            </a>
            <a href="#integrations" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Integrations
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Sign in
            </Link>
            <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 text-center md:px-8 md:pt-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-accent/60 px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="size-1.5 rounded-full bg-brand" />
            Built for pubs, bars &amp; restaurants
          </div>
          <h1 className="text-balance font-heading text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Run your whole venue from one dashboard
          </h1>
          <p className="mt-5 text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
            Beeserv brings live sales, financials, staff scheduling, asset tracking and compliance
            into a single platform — so you spend less time on admin and more time serving your guests.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
              Start your free trial <ArrowRight className="size-4" />
            </Link>
            <Link href="#modules" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              See it in action
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">14-day free trial · no charge until it ends</p>
        </div>

        {/* Real product screenshot */}
        <div className="mx-auto mt-16 max-w-5xl">
          <ScreenshotFrame
            src="/screenshots/dashboard.png"
            alt="Beeserv dashboard showing weekly revenue, sales mix and key venue metrics"
            url="app.beeserv.com/dashboard"
            priority
          />
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 text-sm text-muted-foreground">
          {[
            "Multi-venue support",
            "GPS clock-in",
            "Live Square sales",
            "Compliance tracking",
            "Excel export",
          ].map((item) => (
            <span key={item} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-brand" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── What's new ───────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24 md:px-8">
        <div className="mb-14 text-center">
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-widest text-brand">
            <Sparkles className="size-4" /> Recently shipped
          </p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            New ways to run a tighter ship
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {whatsNew.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-border">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="border-t border-border bg-muted/20 py-24">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <div className="mb-14 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand">Features</p>
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Everything your venue needs
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              Purpose-built tools for hospitality operators — from daily ops to annual compliance.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-brand/40 hover:bg-accent/20"
                >
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-border">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                  </div>
                  <ul className="mt-auto flex flex-col gap-1.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Modules detail (real screenshots) ────────────────────── */}
      <section id="modules" className="mx-auto w-full max-w-7xl px-4 py-24 md:px-8">
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand">Product tour</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Built for every part of your day
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Real screens from Beeserv — this is exactly what you and your team will use.
          </p>
        </div>
        <div className="flex flex-col gap-16">
          {modules.map((mod, i) => {
            const Icon = mod.icon
            const isEven = i % 2 === 0
            return (
              <div
                key={mod.title}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-12"
              >
                <div className={cn("flex flex-col gap-4", !isEven && "md:order-2")}>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary ring-1 ring-border">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="font-heading text-2xl font-bold text-foreground">{mod.title}</h3>
                  <p className="text-base leading-relaxed text-muted-foreground">{mod.description}</p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {mod.points.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="size-4 shrink-0 text-brand" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={cn(!isEven && "md:order-1")}>
                  <ScreenshotFrame src={mod.image} alt={mod.alt} url={mod.url} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────── */}
      <IntegrationsSection />

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <PricingSection />

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
          <BrandLogo variant="onPrimary" className="mx-auto mb-8 h-14 md:h-16" />
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight md:text-4xl">
            Ready to take control of your venue?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/70">
            Join operators across the UK using Beeserv to manage their pubs, bars, and restaurants.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "lg" }), "gap-2 bg-brand text-brand-foreground hover:bg-brand/90")}
            >
              Create a free account <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10")}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:px-8">
          <BrandLogo className="h-12" />
          <p className="text-center">
            &copy; {new Date().getFullYear()} Beeserv. Serving hospitality operators.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="transition-colors hover:text-foreground">Sign in</Link>
            <Link href="/sign-up" className="transition-colors hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Data ─────────────────────────────────────────────────────────────────────

const whatsNew = [
  {
    icon: CalendarClock,
    title: "Scheduled rota publishing",
    description: "Build next week's rota in advance and set it to publish — and notify staff — automatically at a time you choose.",
  },
  {
    icon: Smartphone,
    title: "Staff self-service portal",
    description: "Your team get their own login to view shifts, book leave, swap shifts and check timecards from any phone.",
  },
  {
    icon: CreditCard,
    title: "Live Square sales",
    description: "Connect Square to stream daily takings straight into your dashboard and financials — no manual entry.",
  },
  {
    icon: Wallet,
    title: "Real-time financials",
    description: "P&L, gross profit, labour cost and expense breakdowns update live as takings and costs come in.",
  },
]

const features = [
  {
    icon: ClipboardList,
    title: "Operations",
    description: "Manage orders, suppliers, maintenance and events from a single live view.",
    bullets: ["Order tracking", "Supplier management", "Maintenance jobs", "Events diary"],
  },
  {
    icon: Wallet,
    title: "Financials",
    description: "Track revenue and expenses with a P&L that updates in real time — and live Square takings.",
    bullets: ["P&L overview", "Expense breakdown", "Square sales sync", "Gaming machine duty"],
  },
  {
    icon: Users,
    title: "Staff & Scheduling",
    description: "Build rotas, schedule publishing, manage leave and let staff clock in with GPS.",
    bullets: ["GPS clock-in / out", "Scheduled publishing", "Leave & swaps", "Staff portal"],
  },
  {
    icon: Package,
    title: "Asset Tracking",
    description: "A full register of fixtures, fittings and equipment with photo evidence and valuations.",
    bullets: ["Photo uploads", "Condition tracking", "Replacement value", "Excel export"],
  },
  {
    icon: ShieldCheck,
    title: "Safety & Compliance",
    description: "Stay audit-ready with checklists, certificates, risk assessments and a live compliance score.",
    bullets: ["Daily checklists", "Certificate alerts", "Risk assessments", "Audit history"],
  },
  {
    icon: FileSpreadsheet,
    title: "Reporting & Export",
    description: "Export any dataset to Excel with one click — assets, expenses, staff, and more.",
    bullets: ["One-click Excel export", "Multi-venue reporting", "Group overview", "Print-ready views"],
  },
]

const modules = [
  {
    icon: Users,
    title: "Staff & Scheduling",
    description:
      "Build weekly rotas on a drag-and-drop grid, schedule them to publish automatically, and let staff clock in with GPS so you always know who is on site. Your team get their own portal for shifts, leave and swaps.",
    points: [
      "Drag-and-drop rota builder",
      "Scheduled auto-publishing",
      "GPS-verified clock-in",
      "Staff self-service portal",
      "Leave requests & swaps",
      "Live labour cost tracking",
    ],
    image: "/screenshots/staff.png",
    alt: "Beeserv staff scheduling board with a weekly rota, live shift status and labour cost",
    url: "app.beeserv.com/staff",
  },
  {
    icon: Wallet,
    title: "Financials",
    description:
      "See exactly how your venue is performing. Track revenue, net profit and expenses with a live P&L, connect Square for automatic takings, and drill into your spend by category — then export it all to Excel.",
    points: [
      "Live P&L & gross margin",
      "Square takings sync",
      "Expense breakdown",
      "Avg daily takings",
      "6-month profit trend",
      "One-click export",
    ],
    image: "/screenshots/financials.png",
    alt: "Beeserv financials page with profit and loss chart and expense breakdown",
    url: "app.beeserv.com/financials",
  },
  {
    icon: Package,
    title: "Asset Tracking",
    description:
      "Keep a complete register of every venue asset — from cellar equipment to furniture. Upload photos, track condition and location, record replacement values, and export the whole register to Excel in one click.",
    points: [
      "Photo gallery via Vercel Blob",
      "Condition & location tracking",
      "Replacement valuations",
      "Category breakdown",
      "Purchase & disposal dates",
      "Export to Excel",
    ],
    image: "/screenshots/assets.png",
    alt: "Beeserv asset tracking gallery showing venue equipment with photos and values",
    url: "app.beeserv.com/assets",
  },
  {
    icon: ShieldCheck,
    title: "Safety & Compliance",
    description:
      "Never miss a deadline. Log daily safety checks, track certificate expiry, run risk assessments and store documents — all rolled into a live compliance score so you can see at a glance what needs attention.",
    points: [
      "Live compliance score",
      "Daily checklists",
      "Certificate expiry alerts",
      "Risk assessments",
      "Audits & actions",
      "Document storage",
    ],
    image: "/screenshots/compliance.png",
    alt: "Beeserv safety management overview with a live compliance score and module breakdown",
    url: "app.beeserv.com/compliance",
  },
  {
    icon: ClipboardList,
    title: "Operations",
    description:
      "Run the day-to-day from one place. Track purchase orders and deliveries, manage suppliers, log maintenance jobs, plan events and keep on top of the team's tasks — with everything updating live.",
    points: [
      "Purchase orders & deliveries",
      "Supplier directory",
      "Maintenance jobs",
      "Events planning",
      "Team task board",
      "Status at a glance",
    ],
    image: "/screenshots/operations.png",
    alt: "Beeserv operations page listing purchase orders with suppliers, totals and status",
    url: "app.beeserv.com/operations",
  },
]
