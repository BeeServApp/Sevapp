"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { setActiveVenue } from "@/app/actions/venues"

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

interface VenueContextValue {
  venues: VenueSummary[]
  activeVenue: VenueSummary | null
  user: SessionUser
  hiddenModules: string[]
  switching: boolean
  switchVenue: (id: number) => void
}

const VenueContext = createContext<VenueContextValue | null>(null)

export function VenueProvider({
  venues,
  activeVenueId,
  user,
  hiddenModules = [],
  children,
}: {
  venues: VenueSummary[]
  activeVenueId: number | null
  user: SessionUser
  hiddenModules?: string[]
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
    <VenueContext.Provider value={{ venues, activeVenue, user, hiddenModules, switching, switchVenue }}>
      {children}
    </VenueContext.Provider>
  )
}

export function useVenue() {
  const ctx = useContext(VenueContext)
  if (!ctx) throw new Error("useVenue must be used within a VenueProvider")
  return ctx
}
