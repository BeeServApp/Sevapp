// UK HR / payroll helpers. Pure functions used by both server actions and the
// client UI so validation and calculations stay consistent on both sides.

export type StarterDeclaration = "A" | "B" | "C"
export type StudentLoanPlan = "none" | "plan1" | "plan2" | "plan4"
export type RightToWorkType = "passport" | "share_code" | "brp" | "other"
export type OnboardingStatus = "not_started" | "in_progress" | "submitted" | "approved"

export const STUDENT_LOAN_PLANS: { value: StudentLoanPlan; label: string }[] = [
  { value: "none", label: "No student loan" },
  { value: "plan1", label: "Plan 1" },
  { value: "plan2", label: "Plan 2" },
  { value: "plan4", label: "Plan 4 (Scotland)" },
]

export const RIGHT_TO_WORK_TYPES: { value: RightToWorkType; label: string }[] = [
  { value: "share_code", label: "Online share code" },
  { value: "passport", label: "Passport" },
  { value: "brp", label: "Biometric residence permit" },
  { value: "other", label: "Other document" },
]

export const STARTER_DECLARATIONS: {
  value: StarterDeclaration
  title: string
  description: string
}[] = [
  {
    value: "A",
    title: "Statement A",
    description: "This is my first job since 6 April and I have not received taxable benefits or a pension.",
  },
  {
    value: "B",
    title: "Statement B",
    description: "This is now my only job, but since 6 April I have had another job, or taxable benefits.",
  },
  {
    value: "C",
    title: "Statement C",
    description: "I have another job or receive a pension.",
  },
]

// HMRC default tax codes suggested from the starter declaration for the current
// tax year. These are sensible defaults the owner can override.
export const DEFAULT_TAX_CODE_BY_DECLARATION: Record<StarterDeclaration, string> = {
  A: "1257L",
  B: "1257L W1/M1",
  C: "BR",
}

// UK statutory minimum paid holiday: 5.6 weeks. For a 5-day week that is 28
// days (capped at 28 by statute). This gives a pro-rata figure for part-timers.
export function statutoryHolidayDays(daysWorkedPerWeek: number): number {
  if (!daysWorkedPerWeek || daysWorkedPerWeek <= 0) return 28
  return Math.min(28, Math.round(daysWorkedPerWeek * 5.6))
}

// National Insurance number format: two prefix letters, six digits, one suffix
// letter (A–D). Certain prefixes are disallowed by HMRC.
export function isValidNiNumber(raw: string): boolean {
  const ni = raw.replace(/\s/g, "").toUpperCase()
  if (!/^[A-Z]{2}\d{6}[A-D]$/.test(ni)) return false
  const first = ni[0]
  const second = ni[1]
  if ("DFIQUV".includes(first)) return false
  if ("DFIOQUV".includes(second)) return false
  if (["GB", "BG", "NK", "KN", "TN", "NT", "ZZ"].includes(first + second)) return false
  return true
}

export function formatNiNumber(raw: string): string {
  const ni = raw.replace(/\s/g, "").toUpperCase()
  if (ni.length !== 9) return ni
  return `${ni.slice(0, 2)} ${ni.slice(2, 4)} ${ni.slice(4, 6)} ${ni.slice(6, 8)} ${ni.slice(8)}`
}

// UK sort code: six digits, conventionally shown as 00-00-00.
export function isValidSortCode(raw: string): boolean {
  return /^\d{6}$/.test(raw.replace(/[\s-]/g, ""))
}

export function formatSortCode(raw: string): string {
  const d = raw.replace(/[\s-]/g, "")
  if (d.length !== 6) return raw
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`
}

// UK bank account numbers are 8 digits.
export function isValidAccountNumber(raw: string): boolean {
  return /^\d{8}$/.test(raw.replace(/\s/g, ""))
}

// The fields payroll cannot run without. Used to compute completion + block
// approval until they are present.
export const REQUIRED_ONBOARDING_FIELDS: {
  key: string
  label: string
}[] = [
  { key: "legalFirstName", label: "Legal first name" },
  { key: "legalLastName", label: "Legal last name" },
  { key: "dob", label: "Date of birth" },
  { key: "addressLine1", label: "Address" },
  { key: "postcode", label: "Postcode" },
  { key: "nationalInsuranceNumber", label: "National Insurance number" },
  { key: "starterDeclaration", label: "HMRC starter declaration" },
  { key: "sortCode", label: "Bank sort code" },
  { key: "accountNumber", label: "Bank account number" },
  { key: "startDate", label: "Start date" },
  { key: "emergencyName", label: "Emergency contact" },
  { key: "emergencyPhone", label: "Emergency contact phone" },
]

export function missingRequiredFields(record: Record<string, unknown>): string[] {
  return REQUIRED_ONBOARDING_FIELDS.filter((f) => {
    const v = record[f.key]
    return v == null || v === ""
  }).map((f) => f.label)
}

export function onboardingCompletionPct(record: Record<string, unknown>): number {
  const total = REQUIRED_ONBOARDING_FIELDS.length
  const filled = REQUIRED_ONBOARDING_FIELDS.filter((f) => {
    const v = record[f.key]
    return v != null && v !== ""
  }).length
  return Math.round((filled / total) * 100)
}

// Default UK-oriented onboarding checklist seeded for every new hire.
export const DEFAULT_CHECKLIST_TEMPLATE: {
  label: string
  category: string
}[] = [
  { label: "Send offer letter & contract of employment", category: "paperwork" },
  { label: "Right to Work check completed & evidence stored", category: "compliance" },
  { label: "Collect P45 or complete HMRC starter checklist", category: "payroll" },
  { label: "Add to payroll with NI number & tax code", category: "payroll" },
  { label: "Assess pension auto-enrolment eligibility", category: "payroll" },
  { label: "Collect bank details for wages", category: "payroll" },
  { label: "Health & safety induction", category: "induction" },
  { label: "Food hygiene / allergen training booked", category: "training" },
  { label: "Issue uniform & access / keys", category: "induction" },
  { label: "Add to rota & scheduling", category: "induction" },
]

export const DOCUMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "contract", label: "Contract" },
  { value: "rtw", label: "Right to Work" },
  { value: "certification", label: "Certification / training" },
  { value: "policy", label: "Policy" },
  { value: "other", label: "Other" },
]

// Days until a date (negative = already passed). Null-safe.
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const target = new Date(`${date}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86_400_000)
}

export function poundsToPence(pounds: string | number): number {
  const n = typeof pounds === "string" ? Number.parseFloat(pounds) : pounds
  if (Number.isNaN(n) || n < 0) return 0
  return Math.round(n * 100)
}

export function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2)
}
