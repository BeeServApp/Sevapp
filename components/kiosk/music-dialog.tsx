"use client"

import { useEffect, useState } from "react"
import { Loader2, Music } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getKioskMusic } from "@/app/actions/kiosk"

interface MusicDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasSpotify: boolean
}

/** Embedded Spotify player for the venue's configured playlist. */
export function MusicDialog({ open, onOpenChange, hasSpotify }: MusicDialogProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !hasSpotify) return
    let active = true
    setLoading(true)
    getKioskMusic()
      .then((r) => {
        if (active) setEmbedUrl(r.embedUrl)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, hasSpotify])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="size-5" /> Venue music
          </DialogTitle>
          <DialogDescription>Playing from the venue&apos;s Spotify playlist.</DialogDescription>
        </DialogHeader>

        {!hasSpotify ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No playlist has been set up yet. Add a Spotify playlist in Settings → Venues → Kiosk.
          </p>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-7 animate-spin" />
          </div>
        ) : embedUrl ? (
          <div className="overflow-hidden rounded-xl">
            <iframe
              title="Spotify player"
              src={embedUrl}
              width="100%"
              height="380"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="w-full"
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            The saved playlist link couldn&apos;t be loaded. Check the URL in kiosk settings.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
