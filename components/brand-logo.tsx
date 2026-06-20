import Image from "next/image"
import { cn } from "@/lib/utils"

// Intrinsic dimensions of the trimmed logo PNGs (~3.46:1)
const LOGO_W = 907
const LOGO_H = 262

type BrandLogoProps = {
  /** Set the height via Tailwind (e.g. "h-12 md:h-14"); width scales automatically. */
  className?: string
  /**
   * - "auto": black logo on light surfaces, white logo on dark surfaces (default).
   * - "onPrimary": for elements on `bg-primary`, which inverts between themes.
   */
  variant?: "auto" | "onPrimary"
  priority?: boolean
}

export function BrandLogo({ className, variant = "auto", priority = false }: BrandLogoProps) {
  // .logo-light = shown on light theme, .logo-dark = shown on dark theme.
  const blackClass = variant === "auto" ? "logo-light" : "logo-dark"
  const whiteClass = variant === "auto" ? "logo-dark" : "logo-light"

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/beeserv-logo-black.png"
        alt="Beeserv — Serving Hospitality Operators"
        width={LOGO_W}
        height={LOGO_H}
        priority={priority}
        className={cn(blackClass, "h-full w-auto object-contain")}
      />
      <Image
        src="/beeserv-logo-white.png"
        alt="Beeserv — Serving Hospitality Operators"
        width={LOGO_W}
        height={LOGO_H}
        priority={priority}
        className={cn(whiteClass, "h-full w-auto object-contain")}
      />
    </span>
  )
}
