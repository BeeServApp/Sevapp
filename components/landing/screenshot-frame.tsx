import Image from "next/image"
import { cn } from "@/lib/utils"

type ScreenshotFrameProps = {
  src: string
  alt: string
  /** URL shown in the fake address bar */
  url?: string
  className?: string
  priority?: boolean
}

/**
 * Wraps a real product screenshot in a lightweight browser chrome so the
 * landing page can show genuine UI without it feeling like a bare image.
 */
export function ScreenshotFrame({
  src,
  alt,
  url = "app.beeserv.com",
  className,
  priority = false,
}: ScreenshotFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-xl ring-1 ring-border/50",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-2 border-b border-border bg-muted/50 px-4">
        <span className="size-2.5 rounded-full bg-destructive/50" />
        <span className="size-2.5 rounded-full bg-[oklch(0.8_0.12_75)]/70" />
        <span className="size-2.5 rounded-full bg-brand/60" />
        <span className="mx-auto flex items-center rounded-md bg-background px-3 py-0.5 text-[11px] text-muted-foreground">
          {url}
        </span>
      </div>
      <Image
        src={src || "/placeholder.svg"}
        alt={alt}
        width={1440}
        height={900}
        priority={priority}
        className="h-auto w-full"
        sizes="(max-width: 768px) 100vw, 1024px"
      />
    </div>
  )
}
