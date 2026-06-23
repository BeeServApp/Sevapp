"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { MODULES, STAFF_ALLOWED_PATHS } from "@/lib/nav-config"
import { updateMyHiddenModules } from "@/app/actions/preferences"

// Only the modules a staff member is allowed to see are personalizable.
const STAFF_MODULES = MODULES.filter((m) => STAFF_ALLOWED_PATHS.includes(m.href))

export function StaffPreferencesSettings({ hiddenModules }: { hiddenModules: string[] }) {
  const router = useRouter()
  const [hidden, setHidden] = useState<string[]>(hiddenModules)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggle(href: string, makeHidden: boolean) {
    setHidden((prev) => (makeHidden ? [...new Set([...prev, href])] : prev.filter((h) => h !== href)))
    setMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      await updateMyHiddenModules(hidden)
      setMessage("Preferences saved.")
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save preferences.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="size-4 text-muted-foreground" />
            Sidebar modules
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Hide modules you don&apos;t use to keep your sidebar focused. These preferences are
            personal to your account and don&apos;t affect anyone else.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {STAFF_MODULES.map((m) => {
              const visible = !hidden.includes(m.href)
              return (
                <li key={m.href} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    id={`staff-mod-${m.href}`}
                    checked={visible}
                    onCheckedChange={(c) => toggle(m.href, c !== true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <Label htmlFor={`staff-mod-${m.href}`} className="flex items-center gap-1.5 font-medium">
                      {visible ? (
                        <Eye className="size-3.5 text-brand" />
                      ) : (
                        <EyeOff className="size-3.5 text-muted-foreground" />
                      )}
                      {m.label}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  )
}
