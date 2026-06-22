"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

type Channel = "rota" | "tasks" | "notifications" | "all"
type Listener = (channels: Channel[]) => void

interface RealtimeContextValue {
  connected: boolean
  /** Subscribe to change events. Returns an unsubscribe fn. */
  subscribe: (listener: Listener) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef<Set<Listener>>(new Set())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const connect = () => {
      if (stopped) return
      es = new EventSource("/api/realtime")

      es.addEventListener("ready", () => setConnected(true))

      es.addEventListener("change", (e) => {
        let channels: Channel[] = ["all"]
        try {
          const data = JSON.parse((e as MessageEvent).data)
          if (Array.isArray(data.channels)) channels = data.channels
        } catch {
          /* ignore malformed payloads */
        }
        // Notify subscribers (e.g. SWR mutate) and refresh server components.
        listenersRef.current.forEach((l) => l(channels))
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => router.refresh(), 80)
      })

      es.onerror = () => {
        setConnected(false)
        es?.close()
        // The stream recycles itself periodically; reconnect after a short delay.
        if (!stopped) {
          reconnect = setTimeout(connect, 2000)
        }
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnect) clearTimeout(reconnect)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      es?.close()
    }
  }, [router])

  return <RealtimeContext.Provider value={{ connected, subscribe }}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider")
  return ctx
}

/** Convenience hook: run a callback when a relevant channel changes. */
export function useRealtimeChannel(channels: Channel[], onChange: () => void) {
  const { subscribe } = useRealtime()
  const cbRef = useRef(onChange)
  cbRef.current = onChange
  useEffect(() => {
    return subscribe((changed) => {
      if (changed.includes("all") || changed.some((c) => channels.includes(c))) {
        cbRef.current()
      }
    })
  }, [subscribe, channels])
}
