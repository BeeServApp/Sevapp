"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { DbOnboarding } from "@/lib/db/schema"
import type { OnboardingInput } from "@/app/actions/hr"
import {
  DEFAULT_TAX_CODE_BY_DECLARATION,
  RIGHT_TO_WORK_TYPES,
  STARTER_DECLARATIONS,
  STUDENT_LOAN_PLANS,
  formatSortCode,
  isValidAccountNumber,
  isValidNiNumber,
  isValidSortCode,
  missingRequiredFields,
  onboardingCompletionPct,
  penceToPounds,
  poundsToPence,
  type StarterDeclaration,
} from "@/lib/hr"

// The form state mirrors the DB columns but keeps money as a pounds string for
// friendly editing; it is converted to pence on save.
type FormState = {
  legalFirstName: string
  legalLastName: string
  preferredName: string
  dob: string
  nationality: string
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  personalEmail: string
  personalPhone: string
  nationalInsuranceNumber: string
  rightToWorkType: string
  rightToWorkShareCode: string
  rightToWorkExpiry: string
  starterDeclaration: string
  studentLoanPlan: string
  postgradLoan: boolean
  taxCode: string
  bankName: string
  accountName: string
  sortCode: string
  accountNumber: string
  pensionOptOut: boolean
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  jobTitle: string
  startDate: string
  payType: string
  payRatePounds: string
  holidayEntitlementDays: string
  probationEndDate: string
  reviewDueDate: string
}

function toFormState(r: DbOnboarding | null): FormState {
  return {
    legalFirstName: r?.legalFirstName ?? "",
    legalLastName: r?.legalLastName ?? "",
    preferredName: r?.preferredName ?? "",
    dob: r?.dob ?? "",
    nationality: r?.nationality ?? "",
    addressLine1: r?.addressLine1 ?? "",
    addressLine2: r?.addressLine2 ?? "",
    city: r?.city ?? "",
    postcode: r?.postcode ?? "",
    personalEmail: r?.personalEmail ?? "",
    personalPhone: r?.personalPhone ?? "",
    nationalInsuranceNumber: r?.nationalInsuranceNumber ?? "",
    rightToWorkType: r?.rightToWorkType ?? "",
    rightToWorkShareCode: r?.rightToWorkShareCode ?? "",
    rightToWorkExpiry: r?.rightToWorkExpiry ?? "",
    starterDeclaration: r?.starterDeclaration ?? "",
    studentLoanPlan: r?.studentLoanPlan ?? "none",
    postgradLoan: r?.postgradLoan ?? false,
    taxCode: r?.taxCode ?? "",
    bankName: r?.bankName ?? "",
    accountName: r?.accountName ?? "",
    sortCode: r?.sortCode ?? "",
    accountNumber: r?.accountNumber ?? "",
    pensionOptOut: r?.pensionOptOut ?? false,
    emergencyName: r?.emergencyName ?? "",
    emergencyRelationship: r?.emergencyRelationship ?? "",
    emergencyPhone: r?.emergencyPhone ?? "",
    jobTitle: r?.jobTitle ?? "",
    startDate: r?.startDate ?? "",
    payType: r?.payType ?? "hourly",
    payRatePounds: r ? penceToPounds(r.payRatePence) : "",
    holidayEntitlementDays: r ? String(r.holidayEntitlementDays) : "28",
    probationEndDate: r?.probationEndDate ?? "",
    reviewDueDate: r?.reviewDueDate ?? "",
  }
}

function toInput(f: FormState): OnboardingInput {
  return {
    legalFirstName: f.legalFirstName.trim() || null,
    legalLastName: f.legalLastName.trim() || null,
    preferredName: f.preferredName.trim() || null,
    dob: f.dob || null,
    nationality: f.nationality.trim() || null,
    addressLine1: f.addressLine1.trim() || null,
    addressLine2: f.addressLine2.trim() || null,
    city: f.city.trim() || null,
    postcode: f.postcode.trim().toUpperCase() || null,
    personalEmail: f.personalEmail.trim() || null,
    personalPhone: f.personalPhone.trim() || null,
    nationalInsuranceNumber: f.nationalInsuranceNumber.replace(/\s/g, "").toUpperCase() || null,
    rightToWorkType: f.rightToWorkType || null,
    rightToWorkShareCode: f.rightToWorkShareCode.trim() || null,
    rightToWorkExpiry: f.rightToWorkExpiry || null,
    starterDeclaration: f.starterDeclaration || null,
    studentLoanPlan: f.studentLoanPlan,
    postgradLoan: f.postgradLoan,
    taxCode: f.taxCode.trim().toUpperCase() || null,
    bankName: f.bankName.trim() || null,
    accountName: f.accountName.trim() || null,
    sortCode: f.sortCode.replace(/[\s-]/g, "") || null,
    accountNumber: f.accountNumber.replace(/\s/g, "") || null,
    pensionOptOut: f.pensionOptOut,
    emergencyName: f.emergencyName.trim() || null,
    emergencyRelationship: f.emergencyRelationship.trim() || null,
    emergencyPhone: f.emergencyPhone.trim() || null,
    jobTitle: f.jobTitle.trim() || null,
    startDate: f.startDate || null,
    payType: f.payType,
    payRatePence: poundsToPence(f.payRatePounds || "0"),
    holidayEntitlementDays: Number.parseInt(f.holidayEntitlementDays || "28", 10) || 28,
    probationEndDate: f.probationEndDate || null,
    reviewDueDate: f.reviewDueDate || null,
  }
}

function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

interface Props {
  record: DbOnboarding | null
  // Persist a partial patch. Returns nothing; parent handles state refresh.
  onSave: (input: OnboardingInput) => Promise<void>
  // Called when the staff/owner is ready to submit for approval.
  onSubmit?: () => Promise<{ ok: boolean; missing?: string[] }>
  submitLabel?: string
  // Whether pay/holiday/probation employment terms are shown (owner only).
  showEmploymentTerms?: boolean
  readOnly?: boolean
}

export function OnboardingForm({
  record,
  onSave,
  onSubmit,
  submitLabel = "Submit for approval",
  showEmploymentTerms = false,
  readOnly = false,
}: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(record))
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  const completion = useMemo(() => {
    const input = toInput(form)
    return onboardingCompletionPct(input as Record<string, unknown>)
  }, [form])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const niValid = form.nationalInsuranceNumber === "" || isValidNiNumber(form.nationalInsuranceNumber)
  const sortValid = form.sortCode === "" || isValidSortCode(form.sortCode)
  const accValid = form.accountNumber === "" || isValidAccountNumber(form.accountNumber)

  function chooseDeclaration(value: StarterDeclaration) {
    set("starterDeclaration", value)
    // Suggest the HMRC default tax code if the field is empty.
    if (!form.taxCode) set("taxCode", DEFAULT_TAX_CODE_BY_DECLARATION[value])
  }

  async function handleSave() {
    setError(null)
    if (!niValid) return setError("National Insurance number is not valid.")
    if (!sortValid) return setError("Sort code must be 6 digits.")
    if (!accValid) return setError("Account number must be 8 digits.")
    setSaving(true)
    try {
      await onSave(toInput(form))
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))
    } catch {
      setError("Could not save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!onSubmit) return
    setError(null)
    setMissing([])
    // Persist latest edits first so the server validates fresh data.
    setSubmitting(true)
    try {
      await onSave(toInput(form))
      const res = await onSubmit()
      if (!res.ok) {
        setMissing(res.missing ?? [])
        setError("Some required details are still missing.")
      }
    } catch {
      setError("Could not submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = readOnly || saving || submitting
  const clientMissing = missingRequiredFields(toInput(form) as Record<string, unknown>)

  return (
    <div className="flex flex-col gap-6">
      {/* Completion meter */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Completion</span>
            <span className="tabular-nums text-muted-foreground">{completion}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
            <div
              className={cn("h-full rounded-full transition-all", completion === 100 ? "bg-chart-2" : "bg-primary")}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      {/* Personal details */}
      <section>
        <SectionHeading hint="Your legal name exactly as it appears on official documents.">
          Personal details
        </SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Legal first name" required>
            <Input value={form.legalFirstName} disabled={disabled} onChange={(e) => set("legalFirstName", e.target.value)} />
          </Field>
          <Field label="Legal last name" required>
            <Input value={form.legalLastName} disabled={disabled} onChange={(e) => set("legalLastName", e.target.value)} />
          </Field>
          <Field label="Preferred name">
            <Input value={form.preferredName} disabled={disabled} onChange={(e) => set("preferredName", e.target.value)} />
          </Field>
          <Field label="Date of birth" required>
            <Input type="date" value={form.dob} disabled={disabled} onChange={(e) => set("dob", e.target.value)} />
          </Field>
          <Field label="Nationality">
            <Input value={form.nationality} disabled={disabled} onChange={(e) => set("nationality", e.target.value)} />
          </Field>
        </div>
      </section>

      <Separator />

      {/* Home address */}
      <section>
        <SectionHeading>Home address & contact</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Address line 1" required>
            <Input value={form.addressLine1} disabled={disabled} onChange={(e) => set("addressLine1", e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <Input value={form.addressLine2} disabled={disabled} onChange={(e) => set("addressLine2", e.target.value)} />
          </Field>
          <Field label="Town / city">
            <Input value={form.city} disabled={disabled} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Postcode" required>
            <Input value={form.postcode} disabled={disabled} onChange={(e) => set("postcode", e.target.value)} />
          </Field>
          <Field label="Personal email">
            <Input type="email" value={form.personalEmail} disabled={disabled} onChange={(e) => set("personalEmail", e.target.value)} />
          </Field>
          <Field label="Mobile phone">
            <Input value={form.personalPhone} disabled={disabled} onChange={(e) => set("personalPhone", e.target.value)} />
          </Field>
        </div>
      </section>

      <Separator />

      {/* Right to Work */}
      <section>
        <SectionHeading hint="UK law requires employers to verify every worker's right to work before they start.">
          Right to Work
        </SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="National Insurance number" required>
            <Input
              value={form.nationalInsuranceNumber}
              disabled={disabled}
              placeholder="QQ 12 34 56 C"
              onChange={(e) => set("nationalInsuranceNumber", e.target.value)}
              className={cn(!niValid && "border-destructive")}
            />
            {!niValid && <p className="mt-1 text-xs text-destructive">Format: 2 letters, 6 digits, 1 letter.</p>}
          </Field>
          <Field label="Document type">
            <Select value={form.rightToWorkType} disabled={disabled} onValueChange={(v) => set("rightToWorkType", v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {RIGHT_TO_WORK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.rightToWorkType === "share_code" && (
            <Field label="Online share code">
              <Input value={form.rightToWorkShareCode} disabled={disabled} placeholder="W1 A2 B3 C4" onChange={(e) => set("rightToWorkShareCode", e.target.value)} />
            </Field>
          )}
          <Field label="Document / visa expiry (if any)">
            <Input type="date" value={form.rightToWorkExpiry} disabled={disabled} onChange={(e) => set("rightToWorkExpiry", e.target.value)} />
          </Field>
        </div>
      </section>

      <Separator />

      {/* HMRC starter checklist */}
      <section>
        <SectionHeading hint="Pick the statement that applies. This sets your starting tax code.">
          HMRC new starter declaration
        </SectionHeading>
        <div className="flex flex-col gap-2">
          {STARTER_DECLARATIONS.map((d) => {
            const active = form.starterDeclaration === d.value
            return (
              <button
                key={d.value}
                type="button"
                disabled={disabled}
                onClick={() => chooseDeclaration(d.value)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                  disabled && "opacity-60",
                )}
              >
                <span className="font-medium text-foreground">{d.title}</span>
                <span className="mt-0.5 block text-muted-foreground">{d.description}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Student loan plan">
            <Select value={form.studentLoanPlan} disabled={disabled} onValueChange={(v) => set("studentLoanPlan", v ?? "none")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STUDENT_LOAN_PLANS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tax code">
            <Input value={form.taxCode} disabled={disabled} placeholder="1257L" onChange={(e) => set("taxCode", e.target.value)} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <Switch checked={form.postgradLoan} disabled={disabled} onCheckedChange={(v) => set("postgradLoan", v)} />
          <span className="text-muted-foreground">I have a postgraduate loan</span>
        </label>
      </section>

      <Separator />

      {/* Bank details */}
      <section>
        <SectionHeading hint="Where your wages will be paid.">Bank details</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name on account">
            <Input value={form.accountName} disabled={disabled} onChange={(e) => set("accountName", e.target.value)} />
          </Field>
          <Field label="Bank name">
            <Input value={form.bankName} disabled={disabled} onChange={(e) => set("bankName", e.target.value)} />
          </Field>
          <Field label="Sort code" required>
            <Input
              value={form.sortCode}
              disabled={disabled}
              placeholder="00-00-00"
              onChange={(e) => set("sortCode", e.target.value)}
              onBlur={(e) => set("sortCode", formatSortCode(e.target.value).replace(/-/g, ""))}
              className={cn(!sortValid && "border-destructive")}
            />
            {!sortValid && <p className="mt-1 text-xs text-destructive">6 digits required.</p>}
          </Field>
          <Field label="Account number" required>
            <Input
              value={form.accountNumber}
              disabled={disabled}
              placeholder="12345678"
              onChange={(e) => set("accountNumber", e.target.value)}
              className={cn(!accValid && "border-destructive")}
            />
            {!accValid && <p className="mt-1 text-xs text-destructive">8 digits required.</p>}
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <Switch checked={form.pensionOptOut} disabled={disabled} onCheckedChange={(v) => set("pensionOptOut", v)} />
          <span className="text-muted-foreground">Opt out of workplace pension auto-enrolment</span>
        </label>
      </section>

      <Separator />

      {/* Emergency contact */}
      <section>
        <SectionHeading>Emergency contact</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Full name" required>
            <Input value={form.emergencyName} disabled={disabled} onChange={(e) => set("emergencyName", e.target.value)} />
          </Field>
          <Field label="Relationship">
            <Input value={form.emergencyRelationship} disabled={disabled} onChange={(e) => set("emergencyRelationship", e.target.value)} />
          </Field>
          <Field label="Phone" required>
            <Input value={form.emergencyPhone} disabled={disabled} onChange={(e) => set("emergencyPhone", e.target.value)} />
          </Field>
        </div>
      </section>

      {showEmploymentTerms && (
        <>
          <Separator />
          <section>
            <SectionHeading hint="Employment terms used for payroll and holiday accrual.">
              Employment terms
            </SectionHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Job title">
                <Input value={form.jobTitle} disabled={disabled} onChange={(e) => set("jobTitle", e.target.value)} />
              </Field>
              <Field label="Start date" required>
                <Input type="date" value={form.startDate} disabled={disabled} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field label="Pay type">
                <Select value={form.payType} disabled={disabled} onValueChange={(v) => set("payType", v ?? "hourly")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="salary">Annual salary</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={form.payType === "salary" ? "Annual salary (£)" : "Hourly rate (£)"}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.payRatePounds}
                  disabled={disabled}
                  onChange={(e) => set("payRatePounds", e.target.value)}
                />
              </Field>
              <Field label="Holiday entitlement (days / year)">
                <Input
                  type="number"
                  value={form.holidayEntitlementDays}
                  disabled={disabled}
                  onChange={(e) => set("holidayEntitlementDays", e.target.value)}
                />
              </Field>
              <Field label="Probation end date">
                <Input type="date" value={form.probationEndDate} disabled={disabled} onChange={(e) => set("probationEndDate", e.target.value)} />
              </Field>
              <Field label="First review due">
                <Input type="date" value={form.reviewDueDate} disabled={disabled} onChange={(e) => set("reviewDueDate", e.target.value)} />
              </Field>
            </div>
          </section>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          {missing.length > 0 && (
            <ul className="mt-2 list-inside list-disc">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
          <Button onClick={handleSave} disabled={saving || submitting} variant="outline">
            {saving ? "Saving…" : "Save progress"}
          </Button>
          {onSubmit && (
            <Button onClick={handleSubmit} disabled={saving || submitting || clientMissing.length > 0}>
              {submitting ? "Submitting…" : submitLabel}
            </Button>
          )}
          {savedAt && <span className="text-xs text-muted-foreground">Saved at {savedAt}</span>}
          {onSubmit && clientMissing.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {clientMissing.length} required field{clientMissing.length > 1 ? "s" : ""} left
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}
