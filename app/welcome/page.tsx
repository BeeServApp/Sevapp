import { redirect } from "next/navigation"
import { getCurrentUser, getSession } from "@/lib/session"
import { getSetupState } from "@/app/actions/setup"
import { SetupWizard } from "@/components/setup-wizard"

export const metadata = {
  title: "Welcome to Beeserv",
}

export default async function WelcomePage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  // Staff accounts don't go through the owner setup wizard.
  const me = await getCurrentUser()
  if (me.appRole !== "owner") redirect("/staff")

  const state = await getSetupState()
  if (state.completed) redirect("/")

  return <SetupWizard initial={state} />
}
