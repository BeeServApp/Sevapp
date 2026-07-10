import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Beeserv Kiosk",
  description: "Venue kiosk — clock in, tasks, and daily score.",
}

// iPad-first: fill the device, disable pinch-zoom, cover the notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#16a34a",
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="kiosk-surface min-h-[100dvh] bg-background text-foreground">{children}</div>
}
