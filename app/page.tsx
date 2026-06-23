import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"
import {
  ClipboardList,
  Wallet,
  Users,
  ShieldCheck,
  Package,
  MapPin,
  Clock,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { PricingSection } from "@/components/pricing-section"
import { cn } from "@/lib/utils"
import { getCurrentUser, getSession } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function LandingPage() {
  const session = await getSession()
  if (session?.user) {
    const me = await getCurrentUser()
    redirect(me.appRole === "staff" ? "/portal/home" : "/dashboard")
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
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#modules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Modules
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
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 pt-20 text-center md:px-8 md:pt-28">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-accent/60 px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="size-1.5 rounded-full bg-brand" />
            Built for pubs, bars &amp; restaurants
          </div>
          <h1 className="text-balance font-heading text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Run your whole venue from one dashboard
          </h1>
          <p className="mt-5 text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
            Beeserv brings operations, financials, staff scheduling, asset tracking, and compliance
            into a single platform — so you spend less time on admin and more time serving your guests.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
              Start for free <ArrowRight className="size-4" />
            </Link>
            <Link href="/sign-in" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              Sign in to your account
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required</p>
        </div>

        {/* Mock dashboard card */}
        <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/40 px-4">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-[oklch(0.8_0.12_75)]/80" />
            <span className="size-2.5 rounded-full bg-brand/60" />
            <span className="ml-3 text-xs text-muted-foreground">beeserv.app/dashboard</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
            {[
              { label: "Revenue today", value: "£4,820", up: true },
              { label: "Staff on shift", value: "7 / 9", up: null },
              { label: "Open orders", value: "12", up: false },
              { label: "Compliance score", value: "94%", up: true },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1 p-5">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="font-heading text-2xl font-bold text-foreground">{stat.value}</p>
                {stat.up !== null && (
                  <p className={`text-xs font-medium ${stat.up ? "text-brand" : "text-destructive"}`}>
                    {stat.up ? "▲ 8% vs yesterday" : "▼ 3 pending"}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
            <div className="col-span-2 p-5">
              <p className="mb-3 text-sm font-medium text-foreground">Revenue this week</p>
              <div className="flex h-24 items-end gap-1.5">
                {[55, 70, 48, 82, 66, 90, 76].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-brand/20"
                    style={{ height: `${h}%` }}
                  >
                    <div
                      className="w-full rounded-sm bg-brand"
                      style={{ height: `${Math.round(h * 0.65)}%`, marginTop: `${h - Math.round(h * 0.65)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d} className="flex-1 text-center">{d}</span>
                ))}
              </div>
            </div>
            <div className="p-5">
              <p className="mb-3 text-sm font-medium text-foreground">Quick links</p>
              <ul className="flex flex-col gap-1.5">
                {["Operations", "Financials", "Staff", "Compliance"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-brand/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 text-sm text-muted-foreground">
          {[
            "Multi-venue support",
            "GPS clock-in",
            "Excel export",
            "Compliance tracking",
            "Real-time financials",
          ].map((item) => (
            <span key={item} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-brand" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-24 md:px-8">
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
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-border bg-muted/20 py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-14 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand">How it works</p>
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Up and running in minutes
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col items-start gap-4">
                <div className="flex size-10 items-center justify-center rounded-full border-2 border-brand bg-background font-heading text-sm font-bold text-brand">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules detail ───────────────────────────────────────── */}
      <section id="modules" className="mx-auto w-full max-w-7xl px-4 py-24 md:px-8">
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand">Modules</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Built for every part of your day
          </h2>
        </div>
        <div className="flex flex-col gap-10">
          {modules.map((mod, i) => {
            const Icon = mod.icon
            const isEven = i % 2 === 0
            return (
              <div
                key={mod.title}
                className={`flex flex-col items-center gap-8 rounded-2xl border border-border bg-card p-8 md:flex-row ${!isEven ? "md:flex-row-reverse" : ""}`}
              >
                <div className="flex w-full flex-col gap-4 md:flex-1">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary ring-1 ring-border">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">{mod.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{mod.description}</p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {mod.points.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="size-4 shrink-0 text-brand" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="w-full md:flex-1">
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
                    <div className="flex h-8 items-center gap-1.5 border-b border-border px-3">
                      <span className="size-2 rounded-full bg-border" />
                      <span className="size-2 rounded-full bg-border" />
                      <span className="size-2 rounded-full bg-border" />
                      <span className="ml-2 text-[10px] text-muted-foreground">{mod.title}</span>
                    </div>
                    <div className="p-4">
                      {mod.preview}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

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

const features = [
  {
    icon: ClipboardList,
    title: "Operations",
    description: "Manage orders, suppliers, maintenance and venue tasks from a single live view.",
    bullets: ["Live order tracking", "Supplier management", "Task assignments", "Maintenance logs"],
  },
  {
    icon: Wallet,
    title: "Financials",
    description: "Track revenue, monitor expenses, and see your P&L updated in real time.",
    bullets: ["P&L overview", "Expense tracking", "Revenue charts", "Category breakdown"],
  },
  {
    icon: Users,
    title: "Staff & Scheduling",
    description: "Build rotas, manage leave requests, and let staff clock in with GPS verification.",
    bullets: ["GPS clock-in / out", "Weekly rota builder", "Leave approvals", "Live shift status"],
  },
  {
    icon: Package,
    title: "Asset Tracking",
    description: "Maintain a full register of fixtures, fittings, and equipment with photo evidence.",
    bullets: ["Photo uploads", "Condition tracking", "Excel export", "Disposal records"],
  },
  {
    icon: ShieldCheck,
    title: "Compliance",
    description: "Stay on top of health & safety checks, certificates, and documentation deadlines.",
    bullets: ["Compliance checks", "Certificate expiry alerts", "Document storage", "Audit history"],
  },
  {
    icon: FileSpreadsheet,
    title: "Reporting & Export",
    description: "Export any dataset to Excel with one click — assets, expenses, staff, and more.",
    bullets: ["One-click Excel export", "Multi-venue reporting", "Date-range filters", "Print-ready views"],
  },
]

const steps = [
  {
    title: "Create your account",
    description: "Sign up in seconds. Add your venue details and invite your team — no technical setup required.",
  },
  {
    title: "Configure your venue",
    description: "Add your staff, set up your rota, import your assets, and connect your financial data.",
  },
  {
    title: "Run your operation",
    description: "Track orders, approve leave, clock staff in with GPS, and stay compliant — all from one place.",
  },
]

const modules = [
  {
    icon: Users,
    title: "Staff & Scheduling",
    description:
      "Build weekly rotas with a drag-and-drop grid, handle leave requests with one-click approvals, and let staff clock in using their phone's GPS so you always know who is on site.",
    points: [
      "GPS-verified clock-in / out",
      "Weekly rota builder",
      "Leave request approvals",
      "Live on-shift status",
      "Clock history log",
      "Staff member profiles",
    ],
    preview: (
      <div className="flex flex-col gap-2">
        {[
          { name: "J. Smith", role: "Bar Manager", status: "On shift", color: "bg-brand/20 text-brand" },
          { name: "A. Patel", role: "Chef", status: "On shift", color: "bg-brand/20 text-brand" },
          { name: "C. Brown", role: "Front of House", status: "On leave", color: "bg-[oklch(0.8_0.12_75)]/20 text-[oklch(0.55_0.12_75)]" },
          { name: "M. Lee", role: "Bartender", status: "Off", color: "bg-muted text-muted-foreground" },
        ].map((s) => (
          <div key={s.name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.role}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{s.status}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
          <MapPin className="size-4 text-brand" />
          <p className="text-xs text-foreground">GPS clock-in recorded · 51.5074°N, 0.1278°W</p>
        </div>
      </div>
    ),
  },
  {
    icon: Package,
    title: "Asset Tracking",
    description:
      "Keep a complete register of all your venue assets — from cellar equipment to furniture. Upload photos, track condition, record purchase prices, and export everything to Excel in one click.",
    points: [
      "Asset number register",
      "Photo uploads via Vercel Blob",
      "Condition & location tracking",
      "Purchase & disposal dates",
      "Export to Excel",
      "Category filtering",
    ],
    preview: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-t-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Asset register</span>
          <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground">Export to Excel</span>
        </div>
        {[
          { no: "A-001", name: "Keg Cooler", cat: "Equipment", cond: "Good", price: "£1,200" },
          { no: "A-002", name: "Bar Counter", cat: "Fixtures", cond: "Excellent", price: "£3,500" },
          { no: "A-003", name: "Glasswasher", cat: "Equipment", cond: "Fair", price: "£850" },
        ].map((a) => (
          <div key={a.no} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
            <span className="font-mono text-xs text-muted-foreground">{a.no}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.cat}</p>
            </div>
            <span className="text-xs font-medium text-foreground">{a.price}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    title: "Compliance",
    description:
      "Never miss a compliance deadline. Log health & safety checks, track certificate expiry dates, and store all your venue documents in one place — with a clear audit trail.",
    points: [
      "H&S check logging",
      "Certificate expiry tracking",
      "Document storage",
      "Compliance score",
      "Audit history",
      "Pass / fail recording",
    ],
    preview: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
          <div className="flex size-9 items-center justify-center rounded-full border-2 border-brand bg-brand/10 font-heading text-sm font-bold text-brand">94</div>
          <div>
            <p className="text-sm font-semibold text-foreground">Compliance score</p>
            <p className="text-xs text-muted-foreground">3 checks due this week</p>
          </div>
        </div>
        {[
          { item: "Fire safety check", due: "Today", status: "Due", color: "text-destructive" },
          { item: "Food hygiene cert", due: "14 Jul", status: "Valid", color: "text-brand" },
          { item: "PAT testing", due: "30 Jul", status: "Valid", color: "text-brand" },
        ].map((c) => (
          <div key={c.item} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-sm font-medium text-foreground">{c.item}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{c.due}</span>
              <span className={`text-xs font-medium ${c.color}`}>{c.status}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
]
