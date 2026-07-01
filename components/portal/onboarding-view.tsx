"use client"

import { useState } from "react"
import { CheckCircle2, Clock, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OnboardingForm } from "@/components/staff/onboarding-form"
import type { DbOnboarding } from "@/lib/db/schema"
import { saveMyOnboarding, submitMyOnboarding, type OnboardingInput } from "@/app/actions/hr"

interface Props {
  initialRecord: DbOnboarding | null
}

export function OnboardingView({ initialRecord }: Props) {
  const [record, setRecord] = useState<DbOnboarding | null>(initialRecord)

  // No record means the owner hasn't started onboarding for this person yet.
  if (!record) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> Onboarding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your manager hasn&apos;t started your onboarding yet. Once they do, you&apos;ll be able to fill in your
            details here for payroll.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (record.status === "approved") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-chart-2">
            <CheckCircle2 className="size-4" /> Onboarding complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your onboarding has been approved. If any of your details change (address, bank details, etc.), let your
            manager know so they can update your record.
          </p>
        </CardContent>
      </Card>
    )
  }

  async function handleSave(input: OnboardingInput) {
    const updated = await saveMyOnboarding(input)
    if (updated) setRecord(updated)
  }

  async function handleSubmit() {
    const res = await submitMyOnboarding()
    if (res.ok) {
      setRecord((prev) => (prev ? { ...prev, status: "submitted" } : prev))
    }
    return res
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome — let&apos;s get you set up</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please complete the details below so we can add you to payroll. Everything is stored securely and only seen
            by your manager. Fields marked with an asterisk are required by HMRC and your employer.
          </p>
          {record.status === "submitted" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Clock className="size-4" />
              Submitted for review. You can still make changes and re-submit if needed.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <OnboardingForm
            record={record}
            onSave={handleSave}
            onSubmit={handleSubmit}
            submitLabel={record.status === "submitted" ? "Re-submit" : "Submit for approval"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
