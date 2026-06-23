"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Link2, MapPin, AlertCircle, Copy, ExternalLink, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { SquareConnectionState, SquareLocation } from "@/app/actions/square"
import { disconnectSquare, mapVenueToLocation } from "@/app/actions/square"

const UNMAPPED = "__none__"

export interface IntegrationVenue {
  id: number
  name: string
  squareLocationId: string | null
}

export function IntegrationsSettings({
  connection,
  venues,
  locations,
  flash,
}: {
  connection: SquareConnectionState
  venues: IntegrationVenue[]
  locations: SquareLocation[]
  flash: { connected: boolean; error: string | null }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleMap(venueId: number, value: string | null) {
    setError(null)
    const locationId = value && value !== UNMAPPED ? value : null
    startTransition(async () => {
      try {
        await mapVenueToLocation(venueId, locationId)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update mapping.")
      }
    })
  }

  function handleDisconnect() {
    setError(null)
    startTransition(async () => {
      try {
        await disconnectSquare()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not disconnect.")
      }
    })
  }

  function copyRedirect() {
    navigator.clipboard?.writeText(connection.redirectUri).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const errorLabel =
    flash.error === "not_configured"
      ? "Square is not configured yet. Add your Square app credentials to connect."
      : flash.error === "state_mismatch"
        ? "Connection could not be verified (security check failed). Please try again."
        : flash.error === "exchange_failed"
          ? "Square rejected the connection. Check your app credentials and redirect URL."
          : flash.error
            ? `Square connection failed (${flash.error}).`
            : null

  return (
    <div className="grid gap-4">
      {/* ── Square connection ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-muted-foreground" />
              Square
            </CardTitle>
            <Badge
              className={cn(
                connection.connected
                  ? "bg-brand/15 text-brand"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {connection.connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your Square account to pull sales and transactions into your dashboard.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {flash.connected && (
            <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm text-foreground">
              <Check className="size-4 shrink-0 text-brand" />
              Square connected successfully.
            </div>
          )}

          {errorLabel && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              {errorLabel}
            </div>
          )}

          {connection.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Connected account</p>
                <p className="font-medium text-foreground">
                  {connection.merchantName ?? connection.merchantId ?? "Square account"}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
                  <Unplug className="size-3.5" /> Disconnect
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Square?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the connection and clears all venue-to-location mappings. Sales
                      data will no longer appear on your dashboard. You can reconnect at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : connection.configured ? (
            <div>
              <Button render={<a href="/api/integrations/square/connect" />}>
                <Link2 className="size-4" /> Connect Square
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Square is not configured for this workspace yet. An administrator needs to add the{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">SQUARE_APPLICATION_ID</code> and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">SQUARE_APPLICATION_SECRET</code>{" "}
              environment variables, then register the redirect URL below in the Square Developer
              Dashboard.
            </div>
          )}

          {/* Redirect URL hint — always useful when setting up the Square app. */}
          <div className="rounded-lg border border-border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ExternalLink className="size-3" />
              OAuth redirect URL (register this in your Square app)
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs text-foreground">
                {connection.redirectUri}
              </code>
              <Button variant="outline" size="sm" onClick={copyRedirect}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Venue → Square location mapping ──────────────────────── */}
      {connection.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              Location mapping
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Match each venue to a Square location so its sales show on the dashboard.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {locations.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No Square locations found on the connected account.
              </p>
            )}
            {venues.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <p className="font-medium text-foreground">{v.name}</p>
                <Select
                  value={v.squareLocationId ?? UNMAPPED}
                  onValueChange={(val) => handleMap(v.id, val)}
                  disabled={pending || locations.length === 0}
                >
                  <SelectTrigger className="w-60" aria-label={`Square location for ${v.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNMAPPED}>Not linked</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
