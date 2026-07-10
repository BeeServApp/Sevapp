"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, Loader2, TabletSmartphone, LayoutGrid, Package } from "lucide-react"

import type { DbPosCategory, DbPosProduct, DbPosTerminal } from "@/lib/db/schema"
import { cn } from "@/lib/utils"
import { formatPence, parsePoundsToPence } from "@/lib/pos-format"
import {
  createPosCategory,
  updatePosCategory,
  deletePosCategory,
  createPosProduct,
  updatePosProduct,
  deletePosProduct,
  linkPosTerminal,
  unlinkPosTerminal,
} from "@/app/actions/pos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ManageTab = "products" | "categories" | "terminals"

export function MenuManager({
  venueId,
  categories,
  products,
  terminals,
  onCategoriesChange,
  onProductsChange,
  onTerminalsChange,
}: {
  venueId: number
  categories: DbPosCategory[]
  products: DbPosProduct[]
  terminals: DbPosTerminal[]
  onCategoriesChange: (c: DbPosCategory[]) => void
  onProductsChange: (p: DbPosProduct[]) => void
  onTerminalsChange: (t: DbPosTerminal[]) => void
}) {
  const [tab, setTab] = useState<ManageTab>("products")

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <SubTab active={tab === "products"} onClick={() => setTab("products")} icon={<Package className="size-4" />}>
          Products
        </SubTab>
        <SubTab
          active={tab === "categories"}
          onClick={() => setTab("categories")}
          icon={<LayoutGrid className="size-4" />}
        >
          Categories
        </SubTab>
        <SubTab
          active={tab === "terminals"}
          onClick={() => setTab("terminals")}
          icon={<TabletSmartphone className="size-4" />}
        >
          Terminals
        </SubTab>
      </div>

      {tab === "products" && (
        <ProductsPanel
          venueId={venueId}
          categories={categories}
          products={products}
          onProductsChange={onProductsChange}
        />
      )}
      {tab === "categories" && (
        <CategoriesPanel
          venueId={venueId}
          categories={categories}
          products={products}
          onCategoriesChange={onCategoriesChange}
          onProductsChange={onProductsChange}
        />
      )}
      {tab === "terminals" && (
        <TerminalsPanel venueId={venueId} terminals={terminals} onTerminalsChange={onTerminalsChange} />
      )}
    </div>
  )
}

/* ─────────────────────────── Products ─────────────────────────── */

function ProductsPanel({
  venueId,
  categories,
  products,
  onProductsChange,
}: {
  venueId: number
  categories: DbPosCategory[]
  products: DbPosProduct[]
  onProductsChange: (p: DbPosProduct[]) => void
}) {
  const [editing, setEditing] = useState<DbPosProduct | null>(null)
  const [open, setOpen] = useState(false)

  function openNew() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(p: DbPosProduct) {
    setEditing(p)
    setOpen(true)
  }

  function categoryName(id: number | null) {
    return categories.find((c) => c.id === id)?.name ?? "Uncategorised"
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Products</h2>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Add product
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyCard icon={<Package className="size-7" />} text="No products yet. Add your first item to sell." />
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  {!p.active && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Hidden</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{categoryName(p.categoryId)}</p>
              </div>
              <span className="text-sm font-semibold text-foreground">{formatPence(p.pricePence)}</span>
              <button
                type="button"
                aria-label={`Edit ${p.name}`}
                onClick={() => openEdit(p)}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        venueId={venueId}
        categories={categories}
        product={editing}
        products={products}
        onProductsChange={onProductsChange}
      />
    </section>
  )
}

function ProductDialog({
  open,
  onOpenChange,
  venueId,
  categories,
  product,
  products,
  onProductsChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: number
  categories: DbPosCategory[]
  product: DbPosProduct | null
  products: DbPosProduct[]
  onProductsChange: (p: DbPosProduct[]) => void
}) {
  const isEdit = !!product
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [categoryId, setCategoryId] = useState<string>("none")
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Sync form when opening.
  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (next) {
      setName(product?.name ?? "")
      setPrice(product ? (product.pricePence / 100).toFixed(2) : "")
      setCategoryId(product?.categoryId ? String(product.categoryId) : "none")
      setActive(product?.active ?? true)
      setError(null)
    }
  }

  function submit() {
    setError(null)
    if (!name.trim()) {
      setError("Give the product a name")
      return
    }
    const pricePence = parsePoundsToPence(price)
    if (pricePence == null) {
      setError("Enter a valid price")
      return
    }
    const catId = categoryId === "none" ? null : Number(categoryId)
    startTransition(async () => {
      try {
        if (isEdit && product) {
          const updated = await updatePosProduct({
            id: product.id,
            categoryId: catId,
            name: name.trim(),
            pricePence,
            active,
          })
          onProductsChange(products.map((p) => (p.id === updated.id ? updated : p)))
        } else {
          const created = await createPosProduct({
            venueId,
            categoryId: catId,
            name: name.trim(),
            pricePence,
          })
          onProductsChange([...products, created])
        }
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save product")
      }
    })
  }

  function remove() {
    if (!product) return
    startTransition(async () => {
      try {
        await deletePosProduct(product.id)
        onProductsChange(products.filter((p) => p.id !== product.id))
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete product")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>Products appear on the till grid for staff to add to orders.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pint of Lager" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-price">Price (£)</Label>
              <Input
                id="p-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-cat">Category</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "none")}>
                <SelectTrigger id="p-cat">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 rounded border-border"
              />
              Show on till
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={pending}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────────── Categories ─────────────────────────── */

function CategoriesPanel({
  venueId,
  categories,
  products,
  onCategoriesChange,
  onProductsChange,
}: {
  venueId: number
  categories: DbPosCategory[]
  products: DbPosProduct[]
  onCategoriesChange: (c: DbPosCategory[]) => void
  onProductsChange: (p: DbPosProduct[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DbPosCategory | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function openNew() {
    setEditing(null)
    setName("")
    setError(null)
    setOpen(true)
  }
  function openEdit(c: DbPosCategory) {
    setEditing(c)
    setName(c.name)
    setError(null)
    setOpen(true)
  }

  function submit() {
    if (!name.trim()) {
      setError("Give the category a name")
      return
    }
    startTransition(async () => {
      try {
        if (editing) {
          const updated = await updatePosCategory({ id: editing.id, name: name.trim() })
          onCategoriesChange(categories.map((c) => (c.id === updated.id ? updated : c)))
        } else {
          const created = await createPosCategory({ venueId, name: name.trim() })
          onCategoriesChange([...categories, created])
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save category")
      }
    })
  }

  function remove(c: DbPosCategory) {
    startTransition(async () => {
      try {
        await deletePosCategory(c.id)
        onCategoriesChange(categories.filter((x) => x.id !== c.id))
        // Products in this category become uncategorised locally.
        onProductsChange(products.map((p) => (p.categoryId === c.id ? { ...p, categoryId: null } : p)))
      } catch {
        /* no-op */
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Categories</h2>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Add category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyCard
          icon={<LayoutGrid className="size-7" />}
          text="No categories yet. Group products like Draught, Spirits or Food."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <span className="flex-1 text-sm font-medium text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {products.filter((p) => p.categoryId === c.id).length} items
              </span>
              <button
                type="button"
                aria-label={`Edit ${c.name}`}
                onClick={() => openEdit(c)}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${c.name}`}
                onClick={() => remove(c)}
                disabled={pending}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Draught" />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ─────────────────────────── Terminals ─────────────────────────── */

function TerminalsPanel({
  venueId,
  terminals,
  onTerminalsChange,
}: {
  venueId: number
  terminals: DbPosTerminal[]
  onTerminalsChange: (t: DbPosTerminal[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [deviceId, setDeviceId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function openNew() {
    setLabel("")
    setDeviceId("")
    setError(null)
    setOpen(true)
  }

  function submit() {
    if (!label.trim() || !deviceId.trim()) {
      setError("Enter a name and the terminal's device ID")
      return
    }
    startTransition(async () => {
      try {
        const created = await linkPosTerminal({ venueId, label: label.trim(), deviceId: deviceId.trim() })
        onTerminalsChange([...terminals, created])
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not link terminal")
      }
    })
  }

  function unlink(t: DbPosTerminal) {
    startTransition(async () => {
      try {
        await unlinkPosTerminal(t.id)
        onTerminalsChange(terminals.filter((x) => x.id !== t.id))
      } catch {
        /* no-op */
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Card terminals</h2>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Link terminal
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Link a Dojo (or compatible) card terminal to take card payments from the till. Enter the device ID printed
        on the reader or shown in your Dojo dashboard.
      </p>

      {terminals.length === 0 ? (
        <EmptyCard icon={<TabletSmartphone className="size-7" />} text="No terminals linked yet." />
      ) : (
        <ul className="flex flex-col gap-2">
          {terminals.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <TabletSmartphone className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {t.provider} · {t.deviceId}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Unlink ${t.label}`}
                onClick={() => unlink(t)}
                disabled={pending}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link card terminal</DialogTitle>
            <DialogDescription>Connect a Dojo card reader to accept card payments.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-label">Name</Label>
              <Input id="t-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main bar reader" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-device">Device ID</Label>
              <Input
                id="t-device"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="e.g. DOJO-8891-2231"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Link terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ─────────────────────────── Shared ─────────────────────────── */

function SubTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-brand text-brand-foreground" : "border border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  )
}
