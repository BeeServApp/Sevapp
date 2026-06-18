"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Package, PoundSterling, Layers, CalendarClock, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { AssetDialog } from "@/components/add-asset-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteAsset } from "@/app/actions/assets"
import type { AssetCondition, ViewAsset } from "@/lib/asset-types"
import { cn } from "@/lib/utils"

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
})

const categoryColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

const conditionClasses: Record<string, string> = {
  Excellent: "border-transparent bg-chart-2/15 text-chart-2",
  Good: "border-transparent bg-chart-3/15 text-chart-3",
  Fair: "border-transparent bg-chart-4/20 text-[oklch(0.45_0.11_70)]",
  "Needs repair": "border-transparent bg-destructive/12 text-destructive",
}

function ConditionBadge({ condition }: { condition: AssetCondition }) {
  return (
    <Badge variant="outline" className={cn("font-medium", conditionClasses[condition])}>
      {condition}
    </Badge>
  )
}

function DisposedBadge() {
  return (
    <Badge variant="outline" className="border-transparent bg-muted font-medium text-muted-foreground">
      Disposed
    </Badge>
  )
}

function nextAssetNumber(list: ViewAsset[]) {
  const max = list.reduce((m, a) => {
    const n = Number.parseInt(a.id.replace(/\D/g, ""), 10)
    return Number.isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return `AST-${String(max + 1).padStart(3, "0")}`
}

function AssetActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <MoreVertical className="size-4" />
            <span className="sr-only">Asset actions</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" /> Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AssetsView({
  initialAssets,
  venueId,
}: {
  initialAssets: ViewAsset[]
  venueId: number
}) {
  const [assets, setAssets] = useState<ViewAsset[]>(initialAssets)
  const [editing, setEditing] = useState<ViewAsset | null>(null)
  const [deleting, setDeleting] = useState<ViewAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  // Disposed assets are no longer owned, so they are excluded from current value.
  const activeAssets = useMemo(() => assets.filter((a) => !a.disposalDate), [assets])
  const disposedCount = assets.length - activeAssets.length

  const totalValue = useMemo(
    () => activeAssets.reduce((sum, a) => sum + a.price, 0),
    [activeAssets],
  )

  const summary = useMemo(() => {
    const mostRecent = [...activeAssets].sort(
      (a, b) => Date.parse(b.purchaseDate) - Date.parse(a.purchaseDate),
    )[0]
    return [
      { label: "Total fittings value", value: gbp.format(totalValue), icon: PoundSterling },
      {
        label: "Active assets",
        value: String(activeAssets.length),
        icon: Package,
        sub: disposedCount > 0 ? `${disposedCount} disposed` : undefined,
      },
      {
        label: "Categories",
        value: String(new Set(activeAssets.map((a) => a.category)).size),
        icon: Layers,
      },
      { label: "Latest purchase", value: mostRecent?.purchaseDate ?? "—", icon: CalendarClock },
    ]
  }, [activeAssets, totalValue, disposedCount])

  const categoryValues = useMemo(
    () =>
      Object.entries(
        activeAssets.reduce<Record<string, number>>((acc, a) => {
          acc[a.category] = (acc[a.category] ?? 0) + a.price
          return acc
        }, {}),
      )
        .map(([category, value]) => ({ category, value }))
        .sort((a, b) => b.value - a.value),
    [activeAssets],
  )

  function handleCreated(asset: ViewAsset) {
    setAssets((prev) => [asset, ...prev])
  }

  function handleUpdated(updated: ViewAsset) {
    setAssets((prev) => prev.map((a) => (a.dbId === updated.dbId ? updated : a)))
    setEditing(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setRemoving(true)
    try {
      await deleteAsset(deleting.dbId)
      setAssets((prev) => prev.filter((a) => a.dbId !== deleting.dbId))
      setDeleting(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Asset Tracking"
        description="Register and value the venue's fixtures and fittings."
        actions={
          <AssetDialog
            venueId={venueId}
            nextAssetNumber={nextAssetNumber(assets)}
            onSaved={handleCreated}
          />
        }
      />

      {/* Summary dashboard */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="gap-0 p-5">
              <Icon className="size-4 text-muted-foreground" />
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {s.sub && <p className="mt-0.5 text-xs text-muted-foreground/80">{s.sub}</p>}
            </Card>
          )
        })}
      </div>

      {/* Value by category */}
      {activeAssets.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Fittings value by category</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Total replacement value across {activeAssets.length} active assets
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {categoryValues.map((c, i) => (
                <div
                  key={c.category}
                  style={{
                    width: `${(c.value / totalValue) * 100}%`,
                    backgroundColor: categoryColors[i % categoryColors.length],
                  }}
                  title={`${c.category}: ${gbp.format(c.value)}`}
                />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categoryValues.map((c, i) => (
                <li key={c.category} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: categoryColors[i % categoryColors.length] }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-muted-foreground">{c.category}</p>
                    <p className="font-medium text-foreground tabular-nums">{gbp.format(c.value)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Asset register */}
      <Tabs defaultValue="gallery" className="mt-6">
        <TabsList>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        {/* Gallery view with photos */}
        <TabsContent value="gallery">
          {assets.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No assets yet. Use “Add asset” to register your first fitting.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((a) => (
                <Card
                  key={a.dbId}
                  className={cn("gap-0 overflow-hidden p-0", a.disposalDate && "opacity-75")}
                >
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    <Image
                      src={a.photo || "/placeholder.svg"}
                      alt={a.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className={cn("object-cover", a.disposalDate && "grayscale")}
                    />
                    <Badge
                      variant="outline"
                      className="absolute left-3 top-3 border-transparent bg-card/90 font-medium text-foreground backdrop-blur"
                    >
                      {a.id}
                    </Badge>
                  </div>
                  <CardContent className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{a.name}</p>
                      <div className="flex items-center gap-1">
                        {a.disposalDate ? <DisposedBadge /> : <ConditionBadge condition={a.condition} />}
                        <AssetActions onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} />
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-3 text-sm">
                      <dt className="text-muted-foreground">Serial no.</dt>
                      <dd className="text-right font-mono text-xs text-foreground">{a.serial}</dd>
                      <dt className="text-muted-foreground">Location</dt>
                      <dd className="text-right text-foreground">{a.location}</dd>
                      <dt className="text-muted-foreground">Purchased</dt>
                      <dd className="text-right text-foreground">{a.purchaseDate}</dd>
                      {a.disposalDate && (
                        <>
                          <dt className="text-muted-foreground">Disposed</dt>
                          <dd className="text-right text-foreground">{a.disposalDate}</dd>
                        </>
                      )}
                      <dt className="text-muted-foreground">Price</dt>
                      <dd className="text-right font-semibold text-foreground tabular-nums">
                        {gbp.format(a.price)}
                      </dd>
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Register table view */}
        <TabsContent value="register">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset no.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.dbId} className={cn(a.disposalDate && "opacity-75")}>
                      <TableCell className="font-medium">{a.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Image
                            src={a.photo || "/placeholder.svg"}
                            alt={a.name}
                            width={40}
                            height={40}
                            className={cn(
                              "size-10 shrink-0 rounded-md object-cover",
                              a.disposalDate && "grayscale",
                            )}
                          />
                          <span className="min-w-0">{a.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.serial}</TableCell>
                      <TableCell className="text-muted-foreground">{a.category}</TableCell>
                      <TableCell className="text-muted-foreground">{a.purchaseDate}</TableCell>
                      <TableCell>
                        {a.disposalDate ? <DisposedBadge /> : <ConditionBadge condition={a.condition} />}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {gbp.format(a.price)}
                      </TableCell>
                      <TableCell>
                        <AssetActions onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={6} className="font-medium">
                      Total fittings value (active)
                    </TableCell>
                    <TableCell className="text-right text-base font-semibold tabular-nums">
                      {gbp.format(totalValue)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog (controlled) */}
      {editing && (
        <AssetDialog
          venueId={venueId}
          mode="edit"
          asset={editing}
          onSaved={handleUpdated}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleting?.id} – {deleting?.name} from the register. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={removing}
            >
              {removing ? "Removing..." : "Remove asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
