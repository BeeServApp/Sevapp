"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Check, Copy, Loader2, MonitorSmartphone, RefreshCw, Trash2, Music, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  generateKioskPairCode,
  getVenueKioskSettings,
  revokeKioskDevice,
  setKioskAdminPin,
  setKioskSpotifyUrl,
} from "@/app/actions/kiosk"

type KioskData = Awaited<ReturnType<typeof getVenueKioskSettings>>

export function KioskSettings({ venueId, venueName }: { venueId: number; venueName: string }) {
  const [data, setData] = useState<KioskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [pin, setPin] = useState("")
  const [pinSaved, setPinSaved] = useState(false)
  const [spotify, setSpotify] = useState("")
  const [spotifySaved, setSpotifySaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingPair, startPair] = useTransition()
  const [pendingPin, startPin] = useTransition()
  const [pendingSpotify, startSpotify] = useTransition()

  const load = useCallback(async () => {
    try {
      const d = await getVenueKioskSettings(venueId)
      setData(d)
      setSpotify(d.spotifyPlaylistUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load kiosk settings.")
    } finally {
      setLoading(false)
    }
  }, [venueId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  function generate() {
    setError(null)
    startPair(async () => {
      try {
        await generateKioskPairCode(venueId)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate a code.")
      }
    })
  }

  function copyCode() {
    if (!data?.pairCode) return
    navigator.clipboard?.writeText(data.pairCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function savePin() {
    setError(null)
    setPinSaved(false)
    startPin(async () => {
      try {
        await setKioskAdminPin(venueId, pin)
        setPin("")
        setPinSaved(true)
        setTimeout(() => setPinSaved(false), 2000)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the PIN.")
      }
    })
  }

  function saveSpotify() {
    setError(null)
    setSpotifySaved(false)
    startSpotify(async () => {
      try {
        await setKioskSpotifyUrl(venueId, spotify)
        setSpotifySaved(true)
        setTimeout(() => setSpotifySaved(false), 2000)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the playlist URL.")
      }
    })
  }

  async function revoke(id: number) {
    if (!confirm("Unpair this device? It will be logged out immediately.")) return
    await revokeKioskDevice(id)
    await load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="size-5" /> Kiosk
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Pair an iPad kiosk for <span className="font-medium text-foreground">{venueName}</span>. Staff clock in,
          complete tasks, and see the live venue score. Open{" "}
          <span className="font-mono text-foreground">kiosk.beeserv.app</span> on the device to begin.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        {loading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            {/* Pairing */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Pairing code</h3>
              {data?.pairCode ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-xl bg-secondary px-5 py-3 font-mono text-3xl font-bold tracking-[0.3em] text-secondary-foreground">
                    {data.pairCode}
                  </span>
                  <Button variant="outline" className="gap-1.5 bg-transparent" onClick={copyCode}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="ghost" className="gap-1.5" onClick={generate} disabled={pendingPair}>
                    <RefreshCw className="size-4" /> New code
                  </Button>
                  {data.pairExpiresAt && (
                    <span className="text-xs text-muted-foreground">
                      Expires{" "}
                      {new Date(data.pairExpiresAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              ) : (
                <div>
                  <Button className="gap-1.5" onClick={generate} disabled={pendingPair}>
                    {pendingPair ? <Loader2 className="size-4 animate-spin" /> : <MonitorSmartphone className="size-4" />}
                    Generate pairing code
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Codes are valid for 15 minutes and can only be used once.
                  </p>
                </div>
              )}
            </section>

            {/* Admin PIN */}
            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4" /> Manager PIN
              </h3>
              <p className="text-sm text-muted-foreground">
                {data?.hasAdminPin
                  ? "A manager PIN is set. It exits kiosk lock mode and unlocks stock management. Enter a new one to change it."
                  : "Set a 4–6 digit manager PIN to exit lock mode and open manager-only areas."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder={data?.hasAdminPin ? "New PIN" : "e.g. 1234"}
                  className="max-w-[160px] font-mono tracking-widest"
                />
                <Button onClick={savePin} disabled={pendingPin || pin.length < 4}>
                  {pendingPin ? <Loader2 className="size-4 animate-spin" /> : pinSaved ? <Check className="size-4" /> : null}
                  {pinSaved ? "Saved" : data?.hasAdminPin ? "Update PIN" : "Set PIN"}
                </Button>
              </div>
            </section>

            {/* Spotify */}
            <section className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Music className="size-4" /> Music playlist
              </h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="spotify" className="text-sm text-muted-foreground">
                  Spotify playlist URL
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="spotify"
                    value={spotify}
                    onChange={(e) => setSpotify(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/…"
                    className="max-w-md"
                  />
                  <Button onClick={saveSpotify} disabled={pendingSpotify}>
                    {pendingSpotify ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : spotifySaved ? (
                      <Check className="size-4" />
                    ) : null}
                    {spotifySaved ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>
            </section>

            {/* Devices */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Paired devices</h3>
              {!data || data.devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices paired yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.devices.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <MonitorSmartphone className="size-5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{d.label || "iPad kiosk"}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.lastSeenAt
                            ? `Last seen ${new Date(d.lastSeenAt).toLocaleString("en-GB")}`
                            : "Never connected"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Unpair device"
                        onClick={() => revoke(d.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
