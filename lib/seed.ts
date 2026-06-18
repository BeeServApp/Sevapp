import "server-only"

import { db } from "@/lib/db"
import {
  asset,
  certificate,
  complianceCheck,
  document,
  maintenance,
  member,
  order,
  supplier,
  task,
  venue,
  venueEvent,
} from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// Demo fittings used to seed a brand-new account so the app isn't empty.
const demoAssets = [
  {
    assetNumber: "AST-001",
    name: "Cask Ale Hand Pumps (×6)",
    description: "Brass and ceramic traditional hand pull engines mounted on the main bar.",
    category: "Bar",
    serial: "ANG-HP6-88421",
    price: 2400,
    purchaseDate: "14 Mar 2023",
    condition: "Excellent",
    location: "Main Bar",
    photo: "/assets/hand-pumps.png",
  },
  {
    assetNumber: "AST-002",
    name: "La Marzocco Espresso Machine",
    description: "Two-group commercial espresso machine with integrated steam wands.",
    category: "Bar",
    serial: "LM-LB2-204517",
    price: 8950,
    purchaseDate: "02 Sep 2022",
    condition: "Good",
    location: "Coffee Station",
    photo: "/assets/espresso-machine.png",
  },
  {
    assetNumber: "AST-003",
    name: "Glasswasher — Bar 2",
    description: "Stainless steel undercounter glasswasher, 500mm basket capacity.",
    category: "Bar",
    serial: "WX-GW500-11930",
    price: 1280,
    purchaseDate: "21 Jun 2024",
    condition: "Needs repair",
    location: "Bar 2",
    photo: "/assets/glasswasher.png",
  },
  {
    assetNumber: "AST-004",
    name: "Cellar Cooling Unit",
    description: "Remote condenser cellar cooling system maintaining 11–13°C.",
    category: "Cellar",
    serial: "AC-CCU-77204",
    price: 6400,
    purchaseDate: "10 Nov 2021",
    condition: "Good",
    location: "Cellar",
    photo: "/assets/cellar-cooler.png",
  },
  {
    assetNumber: "AST-005",
    name: "Pioneer PA Sound System",
    description: "Pair of active PA speakers with 12-channel mixer for live music.",
    category: "AV & Tech",
    serial: "PIO-PA12-55310",
    price: 3150,
    purchaseDate: "18 Feb 2023",
    condition: "Excellent",
    location: "Function Room",
    photo: "/assets/sound-system.png",
  },
  {
    assetNumber: "AST-006",
    name: "Oak Dining Tables (×12)",
    description: "Solid oak rustic dining tables for the main restaurant floor.",
    category: "Furniture",
    serial: "FN-OAK12-30188",
    price: 5760,
    purchaseDate: "05 May 2022",
    condition: "Good",
    location: "Restaurant",
    photo: "/assets/oak-tables.png",
  },
  {
    assetNumber: "AST-007",
    name: "Leather Banquette Seating",
    description: "Green leather fixed banquette bench seating along the snug wall.",
    category: "Furniture",
    serial: "FN-BAN-66420",
    price: 4280,
    purchaseDate: "05 May 2022",
    condition: "Fair",
    location: "Snug",
    photo: "/assets/banquette.png",
  },
  {
    assetNumber: "AST-008",
    name: "EPOS Terminal & Card Reader",
    description: "Touchscreen point of sale terminal with integrated card payment reader.",
    category: "AV & Tech",
    serial: "EP-TS-90551",
    price: 1190,
    purchaseDate: "29 Jan 2025",
    condition: "Excellent",
    location: "Main Bar",
    photo: "/assets/epos-terminal.png",
  },
]

const demoOrders = [
  { reference: "BK-2291", supplier: "Booker Wholesale", items: 42, totalPence: 128450, status: "Confirmed", due: "Tomorrow" },
  { reference: "MD-1180", supplier: "Molson Coors", items: 18, totalPence: 291000, status: "Submitted", due: "Thu 13 Jun" },
  { reference: "FF-0934", supplier: "Fresh Fields Produce", items: 27, totalPence: 48620, status: "Delivered", due: "Today" },
  { reference: "BW-0421", supplier: "Bristol Wine Co.", items: 12, totalPence: 104000, status: "Draft", due: "—" },
  { reference: "CC-3302", supplier: "Coca-Cola HBC", items: 9, totalPence: 61275, status: "Confirmed", due: "Fri 14 Jun" },
]

const demoSuppliers = [
  { name: "Booker Wholesale", category: "General / Dry goods", terms: "Net 14", spendMtdPence: 842000, rating: "4.6" },
  { name: "Molson Coors", category: "Draught & beer", terms: "Net 30", spendMtdPence: 1195000, rating: "4.8" },
  { name: "Fresh Fields Produce", category: "Fresh produce", terms: "Net 7", spendMtdPence: 318000, rating: "4.2" },
  { name: "Bristol Wine Co.", category: "Wine & spirits", terms: "Net 30", spendMtdPence: 564000, rating: "4.5" },
]

const demoMaintenance = [
  { assetName: "Glasswasher — Bar 2", issue: "Not reaching temperature", priority: "High", assignee: "Dan O.", status: "In progress" },
  { assetName: "Cellar cooling", issue: "Routine service", priority: "Medium", assignee: "AceCool Ltd", status: "Open" },
  { assetName: "Ladies WC tap", issue: "Dripping", priority: "Low", assignee: "Tom B.", status: "Open" },
  { assetName: "Coffee machine", issue: "Descale & calibrate", priority: "Medium", assignee: "Priya N.", status: "Resolved" },
]

const demoEvents = [
  { name: "Saturday Live Music", date: "Sat 14 Jun", covers: 120, status: "Confirmed", owner: "Sarah W." },
  { name: "Hartley Wedding Reception", date: "Sat 21 Jun", covers: 80, status: "Provisional", owner: "Priya N." },
  { name: "Quiz Night", date: "Tue 17 Jun", covers: 60, status: "Confirmed", owner: "Tom B." },
  { name: "Corporate — Lockwood Ltd", date: "Thu 26 Jun", covers: 35, status: "Enquiry", owner: "Sarah W." },
]

const demoTasks = [
  { title: "Cellar line clean", area: "Cellar", assignee: "Tom B.", due: "Today", done: true, priority: "High" },
  { title: "Stock count — spirits", area: "Bar", assignee: "Priya N.", due: "Today", done: false, priority: "Medium" },
  { title: "Update specials board", area: "Front of house", assignee: "Mia L.", due: "Today", done: false, priority: "Low" },
  { title: "Deep clean kitchen extraction", area: "Kitchen", assignee: "Dan O.", due: "Tomorrow", done: false, priority: "High" },
  { title: "Bottle up fridges", area: "Bar", assignee: "Jack R.", due: "Today", done: false, priority: "Medium" },
]

const demoChecks = [
  { name: "Fire alarm test", frequency: "Weekly", owner: "Tom B.", lastDone: "31 May", status: "Due" },
  { name: "Cellar temperature log", frequency: "Daily", owner: "Dan O.", lastDone: "Today", status: "Complete" },
  { name: "Fridge temperature check", frequency: "Daily", owner: "Priya N.", lastDone: "Today", status: "Complete" },
  { name: "Emergency lighting test", frequency: "Monthly", owner: "Tom B.", lastDone: "02 May", status: "Overdue" },
  { name: "First aid kit check", frequency: "Monthly", owner: "Mia L.", lastDone: "20 May", status: "Due" },
  { name: "Allergen matrix review", frequency: "Quarterly", owner: "Priya N.", lastDone: "01 Apr", status: "Complete" },
]

const demoCertificates = [
  { name: "Premises Licence", authority: "Bristol City Council", expires: "—", status: "Valid" },
  { name: "Food Hygiene Rating", authority: "FSA", expires: "Apr 2027", status: "Valid" },
  { name: "Public Liability Insurance", authority: "Aviva", expires: "30 Jun 2026", status: "Expiring" },
  { name: "PAT Testing", authority: "SafeTest Ltd", expires: "Sep 2026", status: "Valid" },
  { name: "Gas Safety Certificate", authority: "Gas Safe", expires: "Nov 2026", status: "Valid" },
]

const demoDocuments = [
  { name: "Fire Risk Assessment.pdf", category: "Health & Safety", updated: "12 Apr 2026", owner: "Sarah W." },
  { name: "Cellar Management SOP.pdf", category: "Operations", updated: "28 Mar 2026", owner: "Dan O." },
  { name: "Staff Handbook 2026.pdf", category: "HR", updated: "02 Jan 2026", owner: "Sarah W." },
  { name: "Allergen Matrix.xlsx", category: "Food Safety", updated: "01 Apr 2026", owner: "Priya N." },
  { name: "Licensing Objectives.pdf", category: "Licensing", updated: "15 Feb 2026", owner: "Sarah W." },
]

/**
 * Seeds a default venue, team members and demo assets the first time an account
 * is used. Safe to call on every request — it no-ops once a venue exists.
 */
export async function ensureSeeded(userId: string, userName: string, userEmail: string) {
  const existing = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.userId, userId))
    .limit(1)

  if (existing.length > 0) return

  const [created] = await db
    .insert(venue)
    .values({
      userId,
      name: "The Crown & Anchor",
      type: "Pub",
      address: "12 Harbourside",
      city: "Bristol, UK",
    })
    .returning()

  const venueId = created.id

  await db.insert(asset).values(demoAssets.map((a) => ({ ...a, userId, venueId })))

  await db.insert(member).values([
    {
      userId,
      venueId,
      name: userName || "Account Owner",
      email: userEmail,
      role: "Owner",
      status: "Active",
    },
    {
      userId,
      venueId,
      name: "James Patel",
      email: "james.patel@crownanchor.co.uk",
      role: "Manager",
      status: "Active",
    },
    {
      userId,
      venueId,
      name: "Mia Roberts",
      email: "mia.roberts@crownanchor.co.uk",
      role: "Bar Staff",
      status: "Active",
    },
  ])

  await db.insert(order).values(demoOrders.map((o) => ({ ...o, userId, venueId })))
  await db.insert(supplier).values(demoSuppliers.map((s) => ({ ...s, userId, venueId })))
  await db.insert(maintenance).values(demoMaintenance.map((m) => ({ ...m, userId, venueId })))
  await db.insert(venueEvent).values(demoEvents.map((e) => ({ ...e, userId, venueId })))
  await db.insert(task).values(demoTasks.map((t) => ({ ...t, userId, venueId })))
  await db.insert(complianceCheck).values(demoChecks.map((c) => ({ ...c, userId, venueId })))
  await db.insert(certificate).values(demoCertificates.map((c) => ({ ...c, userId, venueId })))
  await db.insert(document).values(demoDocuments.map((d) => ({ ...d, userId, venueId })))
}
