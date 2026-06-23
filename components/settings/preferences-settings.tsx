"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { MODULES, SETTINGS_TABS } from "@/lib/nav-config"
import { updateHiddenTabs } from "@/app/actions/company"

export function PreferencesSettings({
  hiddenModules,
  hiddenSettingsTabs,
}: {
  hiddenModules: string[]
  hiddenSettingsTabs: string[]
}) {
  const router = useRouter()
  const [hiddenMods, setHiddenMods] = useState<string[]>(hiddenModules)
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(hiddenSettingsTabs)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggle(list: string[], setList: (v: string[]) => void, key: string, hidden: boolean) {
    // `hidden` is the desired hidden-state after the toggle.
    setList(hidden ? [...new Set([...list, key])] : list.filter((k) => k !== key))
    setMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      await updateHiddenTabs({ hiddenModules: hiddenMods, hiddenSettingsTabs: hiddenTabs })
      setMessage("Preferences saved.")
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save preferences.")
    } finally {
      setSaving(false)
    }
  }

  const lockableTabs = SETTINGS_TABS.filter((t) => t.lockable)

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="size-4 text-muted-foreground" />
            Sidebar modules
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Hide modules you don&apos;t use to keep the sidebar focused. The Dashboard is always shown.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {MODULES.map((m) => {
              const visible = !hiddenMods.includes(m.href)
              return (
                <li
                  key={m.href}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <Checkbox
                    id={`mod-${m.href}`}
                    checked={visible}
                    onCheckedChange={(c) => toggle(hiddenMods, setHiddenMods, m.href, c !== true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <Label htmlFor={`mod-${m.href}`} className="flex items-center gap-1.5 font-medium">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="size-4 text-muted-foreground" />
            Settings tabs
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Hide settings sections you rarely need. Account and Preferences are always available.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {lockableTabs.map((t) => {
              const visible = !hiddenTabs.includes(t.id)
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <Checkbox
                    id={`tab-${t.id}`}
                    checked={visible}
                    onCheckedChange={(c) => toggle(hiddenTabs, setHiddenTabs, t.id, c !== true)}
                  />
                  <Label htmlFor={`tab-${t.id}`} className="flex items-center gap-1.5 font-medium">
                    {visible ? (
                      <Eye className="size-3.5 text-brand" />
                    ) : (
                      <EyeOff className="size-3.5 text-muted-foreground" />
                    )}
                    {t.label}
                  </Label>
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
