"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { syncSquareSalesNow } from "@/app/actions/square"

const REASON_TEXT: Record<string, string> = {
  not_configured: "Square not set up",
  not_connected: "Connect Square first",
  not_mapped: "Map a venue first",
  no_venue: "No venue selected",
  error: "Sync failed",
}

export function SquareSyncButton({
  scope = "active",
  variant = "outline",
  size = "sm",
}: {
  scope?: "active" | "all"
  variant?: "outline" | "ghost" | "default"
  size?: "sm" | "default"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function run() {
    setDone(false)
    setMessage(null)
    startTransition(async () => {
      try {
        const r = await syncSquareSalesNow(scope)
        if (r.ok) {
          setDone(true)
          router.refresh()
          setTimeout(() => setDone(false), 2500)
        } else {
          setMessage(REASON_TEXT[r.reason ?? "error"] ?? "Sync failed")
          setTimeout(() => setMessage(null), 3000)
        }
      } catch {
        setMessage("Sync failed")
        setTimeout(() => setMessage(null), 3000)
      }
    })
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={run}
      disabled={pending}
      className="gap-1.5"
    >
      {done ? (
        <Check className="size-4" />
      ) : (
        <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      )}
      {pending ? "Syncing…" : done ? "Synced" : message ?? "Sync Square"}
    </Button>
  )
}
