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
}

export interface SessionUser {
  name: string
  email: string
}

interface VenueContextValue {
  venues: VenueSummary[]
  activeVenue: VenueSummary | null
  user: SessionUser
  switching: boolean
  switchVenue: (id: number) => void
}

const VenueContext = createContext<VenueContextValue | null>(null)

export function VenueProvider({
  venues,
  activeVenueId,
  user,
  children,
}: {
  venues: VenueSummary[]
  activeVenueId: number | null
  user: SessionUser
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
    <VenueContext.Provider value={{ venues, activeVenue, user, switching, switchVenue }}>
      {children}
    </VenueContext.Provider>
  )
}

export function useVenue() {
  const ctx = useContext(VenueContext)
  if (!ctx) throw new Error("useVenue must be used within a VenueProvider")
  return ctx
}
