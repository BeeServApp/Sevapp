import "server-only"

import { db } from "@/lib/db"
import { asset, member, venue } from "@/lib/db/schema"
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

  await db.insert(asset).values(
    demoAssets.map((a) => ({ ...a, userId, venueId: created.id })),
  )

  await db.insert(member).values([
    {
      userId,
      venueId: created.id,
      name: userName || "Account Owner",
      email: userEmail,
      role: "Owner",
      status: "Active",
    },
    {
      userId,
      venueId: created.id,
      name: "James Patel",
      email: "james.patel@crownanchor.co.uk",
      role: "Manager",
      status: "Active",
    },
    {
      userId,
      venueId: created.id,
      name: "Mia Roberts",
      email: "mia.roberts@crownanchor.co.uk",
      role: "Bar Staff",
      status: "Active",
    },
  ])
}
