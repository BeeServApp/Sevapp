import type React from "react"
import { PageHeader } from "@/components/page-header"

interface PortalHeaderProps {
  title: string
  description?: string
  /** Optional control rendered on the right (e.g. add or notifications button). */
  action?: React.ReactNode
}

// Use the exact same header as the owner app pages so the portal is visually
// identical. `action` maps onto PageHeader's `actions` slot.
export function PortalHeader({ title, description, action }: PortalHeaderProps) {
  return <PageHeader title={title} description={description} actions={action} />
}
