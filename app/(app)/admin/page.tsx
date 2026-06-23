import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getSuperAdmin } from "@/lib/admin"
import { listAccounts } from "@/app/actions/admin"
import { AdminConsole } from "@/components/admin/admin-console"

export const metadata: Metadata = {
  title: "Admin",
}

export default async function AdminPage() {
  const admin = await getSuperAdmin()
  // Hide the route entirely from anyone who isn't the super admin.
  if (!admin) notFound()

  const accounts = await listAccounts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground text-balance">Admin console</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as super admin ({admin.email}). Manage every account and reset passwords.
        </p>
      </div>
      <AdminConsole accounts={accounts} />
    </div>
  )
}
