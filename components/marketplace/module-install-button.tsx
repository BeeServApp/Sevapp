"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useTransition } from "react"
import { Check, Loader2, Monitor, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { installModule, uninstallModule } from "@/app/actions/modules"

export function ModuleInstallButton({
  moduleId,
  installed,
  canManage,
  openHref,
}: {
  moduleId: string
  installed: boolean
  canManage: boolean
  openHref: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) {
        setError(res.error ?? "Something went wrong")
        return
      }
      router.refresh()
    })
  }

  if (!canManage) {
    // Staff can't install, but can open an already-installed module.
    return installed ? (
      <Button variant="secondary" className="w-full" render={<Link href={openHref} />}>
        <Monitor className="size-4" />
        Open
      </Button>
    ) : (
      <Button variant="secondary" className="w-full" disabled>
        Ask your owner to install
      </Button>
    )
  }

  if (installed) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button className="flex-1" render={<Link href={openHref} />}>
            <Monitor className="size-4" />
            Open
          </Button>
          <Button
            variant="outline"
            onClick={() => run(() => uninstallModule(moduleId))}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Uninstall"}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
          <Check className="size-3.5" />
          Installed
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        onClick={() => run(() => installModule(moduleId))}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Install
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
