"use client"

import { useState } from "react"
import Link from "next/link"
import { LogOut, Monitor, Settings2, Store } from "lucide-react"

import type { DbPosCategory, DbPosProduct, DbPosTerminal } from "@/lib/db/schema"
import { cn } from "@/lib/utils"
import { formatPence } from "@/lib/pos-format"
import { TillView } from "@/components/pos/till-view"
import { MenuManager } from "@/components/pos/menu-manager"

type Tab = "till" | "manage"

export function PosApp({
  venueId,
  venueName,
  userName,
  canManage,
  categories: initialCategories,
  products: initialProducts,
  terminals: initialTerminals,
  todayTotalPence,
  todayCount,
}: {
  venueId: number
  venueName: string
  userName: string
  canManage: boolean
  categories: DbPosCategory[]
  products: DbPosProduct[]
  terminals: DbPosTerminal[]
  todayTotalPence: number
  todayCount: number
}) {
  const [tab, setTab] = useState<Tab>("till")
  const [categories, setCategories] = useState(initialCategories)
  const [products, setProducts] = useState(initialProducts)
  const [terminals, setTerminals] = useState(initialTerminals)
  const [today, setToday] = useState({ total: todayTotalPence, count: todayCount })

  function onSaleComplete(totalPence: number) {
    setToday((t) => ({ total: t.total + totalPence, count: t.count + 1 }))
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Store className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight text-foreground">{venueName}</span>
            <span className="text-xs leading-tight text-muted-foreground">Beeserv EPOS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="mr-2 hidden flex-col items-end sm:flex">
            <span className="text-sm font-semibold text-foreground">{formatPence(today.total)}</span>
            <span className="text-xs text-muted-foreground">
              {today.count} {today.count === 1 ? "sale" : "sales"} today
            </span>
          </div>

          {canManage && (
            <div className="flex items-center rounded-lg border border-border bg-muted p-1">
              <TabButton active={tab === "till"} onClick={() => setTab("till")} icon={<Monitor className="size-4" />}>
                Till
              </TabButton>
              <TabButton
                active={tab === "manage"}
                onClick={() => setTab("manage")}
                icon={<Settings2 className="size-4" />}
              >
                Manage
              </TabButton>
            </div>
          )}

          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {tab === "till" ? (
          <TillView
            venueId={venueId}
            userName={userName}
            categories={categories}
            products={products.filter((p) => p.active)}
            terminals={terminals}
            onSaleComplete={onSaleComplete}
          />
        ) : (
          <MenuManager
            venueId={venueId}
            categories={categories}
            products={products}
            terminals={terminals}
            onCategoriesChange={setCategories}
            onProductsChange={setProducts}
            onTerminalsChange={setTerminals}
          />
        )}
      </main>
    </div>
  )
}

function TabButton({
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
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  )
}
