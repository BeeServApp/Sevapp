"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
} from "@/app/actions/reminders"

type Status = "loading" | "unsupported" | "denied" | "off" | "on"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function EnableNotifications({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("loading")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window

  // Determine the current subscription state on mount.
  const refresh = useCallback(async () => {
    if (!supported) {
      setStatus("unsupported")
      return
    }
    if (Notification.permission === "denied") {
      setStatus("denied")
      return
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      setStatus(sub ? "on" : "off")
    } catch {
      setStatus("off")
    }
  }, [supported])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off")
        return
      }

      const key = await getVapidPublicKey()
      if (!key) {
        setError("Push notifications aren't configured on the server yet.")
        return
      }

      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"))
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      const json = sub.toJSON()
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      })
      setStatus("on")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enable notifications.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setStatus("off")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disable notifications.")
    } finally {
      setBusy(false)
    }
  }

  if (status === "loading") {
    return (
      <Button variant="outline" size={compact ? "sm" : "default"} disabled>
        <Loader2 className="size-4 animate-spin" />
        {compact ? null : "Checking…"}
      </Button>
    )
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&apos;t supported on this device or browser.
      </p>
    )
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications are blocked. Enable them for this site in your browser or phone settings, then reload.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {status === "on" ? (
          <Button variant="outline" size={compact ? "sm" : "default"} onClick={disable} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <BellOff className="size-4" />}
            Turn off alerts
          </Button>
        ) : (
          <Button size={compact ? "sm" : "default"} onClick={enable} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
            Enable phone alerts
          </Button>
        )}
        {status === "on" && (
          <span className="flex items-center gap-1 text-sm text-brand">
            <Bell className="size-3.5" />
            Alerts on
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
