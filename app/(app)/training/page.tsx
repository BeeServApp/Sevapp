import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"

import { TrainingHub } from "@/components/training/training-hub"
import { StaffTrainingView } from "@/components/training/staff-training-view"
import { getCurrentUser, getSession } from "@/lib/session"
import {
  getModulesWithDetails,
  getMyTraining,
  getStaffForAssignment,
  seedStarterTraining,
} from "@/app/actions/training"

export const metadata: Metadata = {
  title: "Training — Tapsheet",
  description: "Assign training videos and documents to your team and track completion.",
}

export default async function TrainingPage() {
  const session = await getSession()
  if (!session?.user) redirect("/sign-in")

  const me = await getCurrentUser()

  if (me.appRole === "staff") {
    const modules = await getMyTraining()
    return (
      <Suspense fallback={null}>
        <StaffTrainingView modules={modules} name={me.name} />
      </Suspense>
    )
  }

  let modules = await getModulesWithDetails()
  // First-run: populate a starter catalogue so the platform feels live.
  if (modules.length === 0) {
    await seedStarterTraining(false)
    modules = await getModulesWithDetails()
  }
  const staff = await getStaffForAssignment()

  return (
    <Suspense fallback={null}>
      <TrainingHub modules={modules} staff={staff} />
    </Suspense>
  )
}
