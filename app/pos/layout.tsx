import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Beeserv EPOS",
  description: "Point of sale for pubs and hospitality.",
}

// iPad-first: lock scaling so the till behaves like a native app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16a34a",
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-muted">{children}</div>
}
