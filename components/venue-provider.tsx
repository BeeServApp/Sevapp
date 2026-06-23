"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { setActiveVenue } from "@/app/actions/venues"
import type { BusinessSummary } from "@/app/actions/business"

export interface VenueSummary {
  id: number
  name: string
  type: string
  address: string | null
  city: string | null
  postcode?: string | null
  phone?: string | null
  email?: string | null
  managerName?: string | null
  capacity?: number | null
  floors?: number | null
  licenseNumber?: string | null
  licenseType?: string | null
  openingHours?: string | null
  status?: string | null
  openingDate?: string | null
  notes?: string | null
}

export interface SessionUser {
  name: string
  email: string
}

type AppRole = "owner" | "staff"

interface VenueContextValue {
  venues: VenueSummary[]
  activeVenue: VenueSummary | null
  user: SessionUser
  hiddenModules: string[]
  appRole: AppRole
  businesses: BusinessSummary[]
  isSuperAdmin: boolean
  switching: boolean
  switchVenue: (id: number) => void
}

const VenueContext = createContext<VenueContextValue | null>(null)

export function VenueProvider({
  venues,
  activeVenueId,
  user,
  hiddenModules = [],
  appRole = "owner",
  businesses = [],
  isSuperAdmin = false,
  children,
}: {
  venues: VenueSummary[]
  activeVenueId: number | null
  user: SessionUser
  hiddenModules?: string[]
  appRole?: AppRole
  businesses?: BusinessSummary[]
  isSuperAdmin?: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  const activeVenue = venues.find((v) => v.id === activeVenueId) ?? venues[0] ?? null

  function switchVenue(id: number) {
    if (id === activeVenue?.id) return
    setSwitching(true)
    setActiveVenue(id)
      .then(() => router.refresh())
      .finally(() => setSwitching(false))
  }

  return (
    <VenueContext.Provider
      value={{
        venues,
        activeVenue,
        user,
        hiddenModules,
        appRole,
        businesses,
        isSuperAdmin,
        switching,
        switchVenue,
      }}
    >
      {children}
    </VenueContext.Provider>
  )
}

export function useVenue() {
  const ctx = useContext(VenueContext)
  if (!ctx) throw new Error("useVenue must be used within a VenueProvider")
  return ctx
}
