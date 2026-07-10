"use server"

import { randomBytes, randomUUID } from "crypto"
import { cookies } from "next/headers"
import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { clockEvent, kioskDevice, maintenance, order, staffMember, supplier, taskCheck, venue } from "@/lib/db/schema"
import { getAccountId } from "@/lib/session"
import { KIOSK_COOKIE, getKioskContext, requireKioskContext, type KioskContext } from "@/lib/kiosk-session"
import { computeAlertState, computeVenueScore } from "@/lib/kiosk-score"
import { getVenueTasksForDate, localISO } from "@/lib/kiosk-tasks"
import { emitChange } from "@/lib/realtime"

/* =============================== Owner side =============================== */
// These run inside the authed main app (Better Auth session) and manage a
// venue's kiosk configuration + paired devices.

const PAIR_TTL_MS = 15 * 60 * 1000 // pairing codes are valid for 15 minutes
const PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous chars

function makePairCode(len = 6): string {
  const bytes = randomBytes(len)
  let out = ""
  for (let i = 0; i < len; i++) out += PAIR_ALPHABET[bytes[i] % PAIR_ALPHABET.length]
  return out
}

async function assertOwnedVenue(accountId: string, venueId: number) {
  const [v] = await db
    .select()
    .from(venue)
    .where(and(eq(venue.id, venueId), eq(venue.userId, accountId)))
    .limit(1)
  if (!v) throw new Error("Venue not found")
  return v
}

/** Generate (or refresh) a short-lived pairing code for a venue. Owner-only. */
export async function generateKioskPairCode(venueId: number) {
  const accountId = await getAccountId()
  await assertOwnedVenue(accountId, venueId)
  const code = makePairCode()
  const expiresAt = new Date(Date.now() + PAIR_TTL_MS)
  await db
    .update(venue)
    .set({ kioskPairCode: code, kioskPairExpiresAt: expiresAt })
    .where(and(eq(venue.id, venueId), eq(venue.userId, accountId)))
  return { code, expiresAt: expiresAt.toISOString() }
}

export async function getVenueKioskSettings(venueId: number) {
  const accountId = await getAccountId()
  const v = await assertOwnedVenue(accountId, venueId)
  const devices = await db
    .select({ id: kioskDevice.id, label: kioskDevice.label, lastSeenAt: kioskDevice.lastSeenAt, createdAt: kioskDevice.createdAt })
    .from(kioskDevice)
    .where(and(eq(kioskDevice.userId, accountId), eq(kioskDevice.venueId, venueId)))
    .orderBy(desc(kioskDevice.createdAt))
  const pairActive = v.kioskPairCode && v.kioskPairExpiresAt && v.kioskPairExpiresAt.getTime() > Date.now()
  return {
    hasAdminPin: !!v.kioskAdminPin,
    spotifyPlaylistUrl: v.spotifyPlaylistUrl ?? "",
    pairCode: pairActive ? v.kioskPairCode : null,
    pairExpiresAt: pairActive ? v.kioskPairExpiresAt?.toISOString() ?? null : null,
    devices,
  }
}

export async function setKioskAdminPin(venueId: number, pin: string) {
  const accountId = await getAccountId()
  await assertOwnedVenue(accountId, venueId)
  const clean = pin.trim()
  if (!/^\d{4,6}$/.test(clean)) throw new Error("Admin PIN must be 4–6 digits")
  await db
    .update(venue)
    .set({ kioskAdminPin: clean })
    .where(and(eq(venue.id, venueId), eq(venue.userId, accountId)))
}

export async function setKioskSpotifyUrl(venueId: number, url: string) {
  const accountId = await getAccountId()
  await assertOwnedVenue(accountId, venueId)
  const clean = url.trim()
  if (clean && !/open\.spotify\.com/.test(clean)) throw new Error("Enter a valid Spotify playlist URL")
  await db
    .update(venue)
    .set({ spotifyPlaylistUrl: clean || null })
    .where(and(eq(venue.id, venueId), eq(venue.userId, accountId)))
}

export async function revokeKioskDevice(deviceId: number) {
  const accountId = await getAccountId()
  await db.delete(kioskDevice).where(and(eq(kioskDevice.id, deviceId), eq(kioskDevice.userId, accountId)))
}

/* =============================== Kiosk side =============================== */
// These run on the paired iPad, authenticated by the device-token cookie.

export interface KioskStatePayload {
  paired: boolean
  venueName?: string
  hasAdminPin?: boolean
  hasSpotify?: boolean
}

export async function getKioskState(): Promise<KioskStatePayload> {
  const ctx = await getKioskContext()
  if (!ctx) return { paired: false }
  return {
    paired: true,
    venueName: ctx.venueName,
    hasAdminPin: ctx.hasAdminPin,
    hasSpotify: !!ctx.spotifyPlaylistUrl,
  }
}

/** Resolve the venue's Spotify playlist as an embeddable player URL. */
export async function getKioskMusic(): Promise<{ embedUrl: string | null }> {
  const ctx = await requireKioskContext()
  const url = ctx.spotifyPlaylistUrl
  if (!url) return { embedUrl: null }
  const m = url.match(/open\.spotify\.com\/(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/)
  if (!m) return { embedUrl: null }
  return { embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0` }
}

/** Pair this device to a venue using an owner-generated code. */
export async function pairKioskDevice(code: string): Promise<{ venueName: string }> {
  const clean = code.trim().toUpperCase()
  if (!clean) throw new Error("Enter a pairing code")

  const [v] = await db.select().from(venue).where(eq(venue.kioskPairCode, clean)).limit(1)
  if (!v || !v.kioskPairExpiresAt || v.kioskPairExpiresAt.getTime() < Date.now()) {
    throw new Error("That pairing code is invalid or has expired")
  }

  const token = randomUUID() + randomUUID().replace(/-/g, "")
  await db.insert(kioskDevice).values({
    userId: v.userId,
    venueId: v.id,
    token,
    label: v.name,
    lastSeenAt: new Date(),
  })
  // One-time code: clear it so it can't be reused.
  await db.update(venue).set({ kioskPairCode: null, kioskPairExpiresAt: null }).where(eq(venue.id, v.id))

  const store = await cookies()
  store.set(KIOSK_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year; revoked server-side when unpaired
  })
  return { venueName: v.name }
}

/** Verify the venue admin PIN (gates lock-exit and manager areas). */
export async function verifyKioskAdminPin(pin: string): Promise<boolean> {
  const ctx = await requireKioskContext()
  const [v] = await db.select({ pin: venue.kioskAdminPin }).from(venue).where(eq(venue.id, ctx.venueId)).limit(1)
  return !!v?.pin && v.pin === pin.trim()
}

/** Exit kiosk mode: verify PIN, revoke the device, and clear the cookie. */
export async function unpairKioskDevice(pin: string): Promise<{ ok: boolean }> {
  const ctx = await requireKioskContext()
  const ok = await verifyKioskAdminPin(pin)
  if (!ok) return { ok: false }
  await db.delete(kioskDevice).where(eq(kioskDevice.id, ctx.deviceId))
  const store = await cookies()
  store.delete(KIOSK_COOKIE)
  return { ok: true }
}

/** Clock a staff member in/out by their 4-digit PIN. */
export async function kioskClockPunch(pin: string): Promise<{
  ok: boolean
  name?: string
  action?: "in" | "out"
  onTime?: boolean
  error?: string
}> {
  const ctx = await requireKioskContext()
  const clean = pin.trim()
  if (!/^\d{4}$/.test(clean)) return { ok: false, error: "Enter your 4-digit PIN" }

  const staff = await db
    .select()
    .from(staffMember)
    .where(and(eq(staffMember.userId, ctx.accountId), eq(staffMember.venueId, ctx.venueId)))
  const member = staff.find((m) => m.clockPin === clean)
  if (!member) return { ok: false, error: "PIN not recognised" }

  // Toggle based on this member's most recent clock event.
  const [last] = await db
    .select()
    .from(clockEvent)
    .where(
      and(
        eq(clockEvent.userId, ctx.accountId),
        eq(clockEvent.venueId, ctx.venueId),
        eq(clockEvent.staffMemberId, member.id),
      ),
    )
    .orderBy(desc(clockEvent.createdAt))
    .limit(1)

  const action: "in" | "out" = last?.type === "in" ? "out" : "in"
  await db.insert(clockEvent).values({
    userId: ctx.accountId,
    venueId: ctx.venueId,
    staffMemberId: member.id,
    staffName: member.name,
    type: action,
    locationLabel: "Kiosk",
  })
  await db
    .update(staffMember)
    .set({ status: action === "in" ? "On" : "Off" })
    .where(and(eq(staffMember.id, member.id), eq(staffMember.userId, ctx.accountId)))
  await emitChange(ctx.accountId, "rota")

  return { ok: true, name: member.name, action }
}

async function getClockedInStaff(ctx: KioskContext): Promise<{ name: string; since: string }[]> {
  const rows = await db
    .select()
    .from(clockEvent)
    .where(and(eq(clockEvent.userId, ctx.accountId), eq(clockEvent.venueId, ctx.venueId)))
    .orderBy(desc(clockEvent.createdAt))
    .limit(200)
  const seen = new Map<number, (typeof rows)[number]>()
  for (const e of rows) if (!seen.has(e.staffMemberId)) seen.set(e.staffMemberId, e)
  return Array.from(seen.values())
    .filter((e) => e.type === "in")
    .map((e) => ({ name: e.staffName, since: e.createdAt.toISOString() }))
}

export async function getKioskDashboard() {
  const ctx = await requireKioskContext()
  const today = localISO()
  const [score, alert, clockedIn, tasks] = await Promise.all([
    computeVenueScore(ctx.accountId, ctx.venueId, today),
    computeAlertState(ctx.accountId, ctx.venueId, today),
    getClockedInStaff(ctx),
    getVenueTasksForDate(ctx.accountId, ctx.venueId, today),
  ])
  return {
    venueName: ctx.venueName,
    hasSpotify: !!ctx.spotifyPlaylistUrl,
    score,
    alert,
    clockedIn,
    tasksTotal: tasks.length,
    tasksCompleted: tasks.filter((t) => t.status === "Completed").length,
  }
}

export async function getKioskAlertState() {
  const ctx = await requireKioskContext()
  return computeAlertState(ctx.accountId, ctx.venueId)
}

export async function getKioskTasks() {
  const ctx = await requireKioskContext()
  return getVenueTasksForDate(ctx.accountId, ctx.venueId, localISO())
}

export async function completeKioskTask(taskId: number, photoUrl?: string, completedBy?: string) {
  const ctx = await requireKioskContext()
  await db
    .update(taskCheck)
    .set({
      status: "Completed",
      completedBy: completedBy?.trim() || "Kiosk",
      completedAt: new Date(),
      photoUrl: photoUrl ?? undefined,
    })
    .where(and(eq(taskCheck.id, taskId), eq(taskCheck.userId, ctx.accountId), eq(taskCheck.venueId, ctx.venueId)))
  await emitChange(ctx.accountId, "tasks")
  return { ok: true }
}

/* ------------------------------ Maintenance ------------------------------ */

export async function logKioskMaintenance(input: { assetName: string; issue?: string; priority?: string }) {
  const ctx = await requireKioskContext()
  const assetName = input.assetName.trim()
  if (!assetName) throw new Error("What needs attention?")
  const now = new Date()
  const loggedDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const [created] = await db
    .insert(maintenance)
    .values({
      userId: ctx.accountId,
      venueId: ctx.venueId,
      assetName,
      issue: input.issue?.trim() || null,
      priority: input.priority || "Medium",
      status: "Open",
      loggedDate,
      scheduledDate: localISO(now),
    })
    .returning()
  await emitChange(ctx.accountId, "all")
  return created
}

export async function getKioskMaintenance() {
  const ctx = await requireKioskContext()
  return db
    .select()
    .from(maintenance)
    .where(and(eq(maintenance.userId, ctx.accountId), eq(maintenance.venueId, ctx.venueId)))
    .orderBy(desc(maintenance.id))
    .limit(20)
}

/* -------------------------- Stock (manager-gated) ------------------------- */

async function requireAdmin(pin: string) {
  const ok = await verifyKioskAdminPin(pin)
  if (!ok) throw new Error("Manager PIN required")
  return requireKioskContext()
}

export async function getKioskStock(pin: string) {
  const ctx = await requireAdmin(pin)
  const [orders, suppliers] = await Promise.all([
    db
      .select()
      .from(order)
      .where(and(eq(order.userId, ctx.accountId), eq(order.venueId, ctx.venueId)))
      .orderBy(desc(order.id)),
    db
      .select()
      .from(supplier)
      .where(and(eq(supplier.userId, ctx.accountId), eq(supplier.venueId, ctx.venueId)))
      .orderBy(desc(supplier.id)),
  ])
  return { orders, suppliers }
}

export async function createKioskOrder(input: {
  pin: string
  reference: string
  supplier: string
  items: number
  status?: string
  due?: string
}) {
  const ctx = await requireAdmin(input.pin)
  const reference = input.reference.trim()
  const supplierName = input.supplier.trim()
  if (!reference) throw new Error("Order reference is required")
  if (!supplierName) throw new Error("Supplier is required")
  const [created] = await db
    .insert(order)
    .values({
      userId: ctx.accountId,
      venueId: ctx.venueId,
      reference,
      supplier: supplierName,
      items: input.items || 0,
      status: input.status || "Draft",
      due: input.due || null,
    })
    .returning()
  await emitChange(ctx.accountId, "all")
  return created
}

export async function updateKioskOrderStatus(pin: string, orderId: number, status: string) {
  const ctx = await requireAdmin(pin)
  await db
    .update(order)
    .set({ status })
    .where(and(eq(order.id, orderId), eq(order.userId, ctx.accountId), eq(order.venueId, ctx.venueId)))
  await emitChange(ctx.accountId, "all")
  return { ok: true }
}
