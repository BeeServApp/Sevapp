import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Social Assets — Beeserv",
  description: "Download Beeserv social media covers and feed graphics.",
}

type Asset = {
  title: string
  description: string
  src: string
  filename: string
  dimensions: string
  aspect: string
}

const assets: Asset[] = [
  {
    title: "Facebook Page Cover",
    description: "851 × 315 px — Facebook business page cover photo.",
    src: "/social/facebook-cover-851x315.png",
    filename: "facebook-cover-851x315.png",
    dimensions: "851 × 315",
    aspect: "851 / 315",
  },
  {
    title: "LinkedIn Company Banner",
    description: "1128 × 191 px — LinkedIn company page banner.",
    src: "/social/linkedin-company-cover-1128x191.png",
    filename: "linkedin-company-cover-1128x191.png",
    dimensions: "1128 × 191",
    aspect: "1128 / 191",
  },
  {
    title: "LinkedIn Personal Banner",
    description: "1584 × 396 px — LinkedIn personal profile background.",
    src: "/social/linkedin-personal-cover-1584x396.png",
    filename: "linkedin-personal-cover-1584x396.png",
    dimensions: "1584 × 396",
    aspect: "1584 / 396",
  },
  {
    title: "Feed Post — Dashboard",
    description: '1080 × 1080 px — "Run your whole venue from one dashboard."',
    src: "/social/feed-square-dashboard-1080.png",
    filename: "feed-square-dashboard-1080.png",
    dimensions: "1080 × 1080",
    aspect: "1 / 1",
  },
  {
    title: "Feed Post — Platform",
    description: '1080 × 1080 px — "Sales. Staff & HR. Compliance. Assets."',
    src: "/social/feed-square-platform-1080.png",
    filename: "feed-square-platform-1080.png",
    dimensions: "1080 × 1080",
    aspect: "1 / 1",
  },
]

export default function SocialAssetsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-10 flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Beeserv</p>
          <h1 className="text-balance text-3xl font-semibold text-foreground md:text-4xl">Social Media Assets</h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Ready-to-use covers and feed graphics, exported at the exact dimensions each platform expects. Preview
            below, then use the download button to save each file.
          </p>
        </header>

        <div className="flex flex-col gap-8">
          {assets.map((asset) => (
            <article
              key={asset.filename}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-6"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-card-foreground">{asset.title}</h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {asset.dimensions}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{asset.description}</p>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.src || "/placeholder.svg"}
                  alt={`${asset.title} preview`}
                  className="h-auto w-full"
                  style={{ aspectRatio: asset.aspect }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={asset.src}
                  download={asset.filename}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
                >
                  Download PNG
                </a>
                <a
                  href={asset.src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Open in new tab
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
