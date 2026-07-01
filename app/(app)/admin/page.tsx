import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getSuperAdmin } from "@/lib/admin"
import { getAdminMetrics, listAccounts } from "@/app/actions/admin"
import { AdminConsole } from "@/components/admin/admin-console"

export const metadata: Metadata = {
  title: "Admin",
}

export default async function AdminPage() {
  const admin = await getSuperAdmin()
  // Hide the route entirely from anyone who isn't the super admin.
  if (!admin) notFound()

  const [accounts, metrics] = await Promise.all([listAccounts(), getAdminMetrics()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground text-balance">Admin console</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as super admin ({admin.email}). Track revenue and manage every customer, venue and account.
        </p>
      </div>
      <AdminConsole accounts={accounts} metrics={metrics} />
    </div>
  )
}
