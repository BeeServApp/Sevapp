import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AuthForm } from "@/components/auth-form"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const session = await getSession()
  if (session?.user) redirect("/")
  const { plan } = await searchParams
  return <AuthForm mode="sign-up" plan={plan} />
}
