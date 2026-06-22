import type React from "react"

interface PortalHeaderProps {
  title: React.ReactNode
  /** Optional control rendered on the right (e.g. add or notifications button). */
  action?: React.ReactNode
}

export function PortalHeader({ title, action }: PortalHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 py-3">
      <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">{title}</h1>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
