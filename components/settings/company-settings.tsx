"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, MapPin, Palette, Globe2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateCompany, type CompanyData } from "@/app/actions/company"

const currencies = ["GBP", "EUR", "USD", "AUD", "CAD", "NZD"]
const timezones = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Madrid",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
]
const fyStarts = ["January", "April", "July", "October"]
const dateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]

export function CompanySettings({ company }: { company: CompanyData }) {
  const router = useRouter()
  const [form, setForm] = useState(company)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function set<K extends keyof CompanyData>(key: K, value: CompanyData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setMessage("Company name is required.")
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await updateCompany({
        name: form.name,
        tradingName: form.tradingName,
        registrationNumber: form.registrationNumber,
        vatNumber: form.vatNumber,
        email: form.email,
        phone: form.phone,
        website: form.website,
        address: form.address,
        city: form.city,
        postcode: form.postcode,
        country: form.country,
        brandColor: form.brandColor,
        currency: form.currency,
        timezone: form.timezone,
        financialYearStart: form.financialYearStart,
        dateFormat: form.dateFormat,
      })
      setMessage("Company details saved.")
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save company details.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {/* Business identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            Business identity
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            The legal and trading details for your company.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Harbourside Hospitality Ltd"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-trading">Trading name</Label>
            <Input
              id="company-trading"
              value={form.tradingName}
              onChange={(e) => set("tradingName", e.target.value)}
              placeholder="e.g. Harbourside Group"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-reg">Company registration no.</Label>
            <Input
              id="company-reg"
              value={form.registrationNumber}
              onChange={(e) => set("registrationNumber", e.target.value)}
              placeholder="e.g. 09876543"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-vat">VAT number</Label>
            <Input
              id="company-vat"
              value={form.vatNumber}
              onChange={(e) => set("vatNumber", e.target.value)}
              placeholder="e.g. GB123456789"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact & address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            Contact &amp; address
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Head office contact details.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="company-email">Contact email</Label>
            <Input
              id="company-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="hello@company.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-phone">Phone</Label>
            <Input
              id="company-phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="e.g. 0117 123 4567"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://company.com"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="company-address">Head office address</Label>
            <Input
              id="company-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="e.g. 1 Harbourside"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-city">City / region</Label>
            <Input
              id="company-city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="e.g. Bristol"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-postcode">Postcode</Label>
            <Input
              id="company-postcode"
              value={form.postcode}
              onChange={(e) => set("postcode", e.target.value)}
              placeholder="e.g. BS1 5TT"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="company-country">Country</Label>
            <Input
              id="company-country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="e.g. United Kingdom"
            />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            Branding
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Your brand accent colour, used for highlights across the app.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="company-color">Brand colour</Label>
            <div className="flex items-center gap-3">
              <input
                id="company-color"
                type="color"
                value={form.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
                aria-label="Brand colour picker"
              />
              <Input
                value={form.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                className="max-w-[12rem] font-mono"
                placeholder="#16a34a"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locale & finance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="size-4 text-muted-foreground" />
            Locale &amp; finance
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Defaults used for currency, dates and financial reporting.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="company-currency">Currency</Label>
            <Select value={form.currency} onValueChange={(v) => set("currency", v ?? "GBP")}>
              <SelectTrigger id="company-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-timezone">Timezone</Label>
            <Select value={form.timezone} onValueChange={(v) => set("timezone", v ?? "Europe/London")}>
              <SelectTrigger id="company-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-fy">Financial year start</Label>
            <Select
              value={form.financialYearStart}
              onValueChange={(v) => set("financialYearStart", v ?? "April")}
            >
              <SelectTrigger id="company-fy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fyStarts.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-dateformat">Date format</Label>
            <Select value={form.dateFormat} onValueChange={(v) => set("dateFormat", v ?? "DD/MM/YYYY")}>
              <SelectTrigger id="company-dateformat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFormats.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || !form.name.trim()}>
          {saving ? "Saving..." : "Save company details"}
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </form>
  )
}
