import Link from "next/link"
import { Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PosEmptyState({ reason }: { reason: "no-venue" }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Monitor className="size-8" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">No venue selected</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {reason === "no-venue"
            ? "Add or select a venue in the main app before opening the EPOS till."
            : "The till is unavailable right now."}
        </p>
      </div>
      <Button render={<Link href="/dashboard">Back to Beeserv</Link>} />
    </div>
  )
}
