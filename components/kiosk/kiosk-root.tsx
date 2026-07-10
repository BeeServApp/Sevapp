"use client"

import { useCallback, useEffect, useState } from "react"
import { getKioskState, type KioskStatePayload } from "@/app/actions/kiosk"
import { PairScreen } from "@/components/kiosk/pair-screen"
import { KioskShell } from "@/components/kiosk/kiosk-shell"
import { ClockView } from "@/components/kiosk/clock-view"
import { DashboardView } from "@/components/kiosk/dashboard-view"
import { TasksView } from "@/components/kiosk/tasks-view"
import { StockView } from "@/components/kiosk/stock-view"
import { MaintenanceView } from "@/components/kiosk/maintenance-view"
import { MusicDialog } from "@/components/kiosk/music-dialog"
import { getKioskAlertState } from "@/app/actions/kiosk"

export type KioskNav = "home" | "dashboard" | "tasks" | "stock" | "maintenance"

const ALERT_POLL_MS = 20000

export function KioskRoot({ initialState }: { initialState: KioskStatePayload }) {
  const [state, setState] = useState(initialState)
  const [nav, setNav] = useState<KioskNav>("home")
  const [musicOpen, setMusicOpen] = useState(false)
  const [alert, setAlert] = useState<{ alert: boolean; reasons: string[] }>({ alert: false, reasons: [] })

  // Poll the alert state so the screen flashes red as soon as something slips.
  const refreshAlert = useCallback(async () => {
    if (!state.paired) return
    try {
      setAlert(await getKioskAlertState())
    } catch {
      /* ignore transient errors */
    }
  }, [state.paired])

  useEffect(() => {
    if (!state.paired) return
    refreshAlert()
    const id = setInterval(refreshAlert, ALERT_POLL_MS)
    return () => clearInterval(id)
  }, [state.paired, refreshAlert])

  const handlePaired = useCallback(async () => {
    // Re-fetch full state after pairing so we pick up venue name / config.
    const next = await getKioskState()
    setState(next)
    setNav("home")
  }, [])

  const handleUnpaired = useCallback(() => {
    setState({ paired: false })
    setNav("home")
  }, [])

  if (!state.paired) {
    return <PairScreen onPaired={handlePaired} />
  }

  return (
    <>
      <KioskShell
        venueName={state.venueName ?? "Venue"}
        hasAdminPin={!!state.hasAdminPin}
        alert={alert}
        nav={nav}
        onNav={setNav}
        onMusic={() => setMusicOpen(true)}
        onUnpaired={handleUnpaired}
      >
        {nav === "home" && <ClockView onPunch={refreshAlert} />}
        {nav === "dashboard" && <DashboardView />}
        {nav === "tasks" && <TasksView onChange={refreshAlert} />}
        {nav === "stock" && <StockView hasAdminPin={!!state.hasAdminPin} />}
        {nav === "maintenance" && <MaintenanceView />}
      </KioskShell>
      <MusicDialog open={musicOpen} onOpenChange={setMusicOpen} hasSpotify={!!state.hasSpotify} />
    </>
  )
}
