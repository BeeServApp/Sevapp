import { pgTable, text, timestamp, boolean, serial, integer, doublePrecision } from "drizzle-orm/pg-core"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// --- App tables ------------------------------------------------------------
// Scoped per account owner via `userId`. No foreign keys (per stack guidance).

export const venue = pgTable("venue", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Pub"),
  address: text("address"),
  city: text("city"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const member = pgTable("member", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("Staff"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const asset = pgTable("asset", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  assetNumber: text("assetNumber").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("Bar"),
  serial: text("serial"),
  price: integer("price").notNull().default(0),
  purchaseDate: text("purchaseDate"),
  disposalDate: text("disposalDate"),
  condition: text("condition").notNull().default("Good"),
  location: text("location"),
  photo: text("photo"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Operations ------------------------------------------------------------

export const order = pgTable("order", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  reference: text("reference").notNull(),
  supplier: text("supplier").notNull(),
  items: integer("items").notNull().default(0),
  totalPence: integer("totalPence").notNull().default(0),
  status: text("status").notNull().default("Draft"),
  due: text("due"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const supplier = pgTable("supplier", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  terms: text("terms").notNull().default("Net 30"),
  spendMtdPence: integer("spendMtdPence").notNull().default(0),
  rating: text("rating").notNull().default("4.5"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const maintenance = pgTable("maintenance", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  assetName: text("assetName").notNull(),
  issue: text("issue"),
  priority: text("priority").notNull().default("Medium"),
  assignee: text("assignee"),
  status: text("status").notNull().default("Open"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const venueEvent = pgTable("venue_event", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  date: text("date"),
  covers: integer("covers").notNull().default(0),
  status: text("status").notNull().default("Provisional"),
  owner: text("owner"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const task = pgTable("task", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  area: text("area"),
  assignee: text("assignee"),
  due: text("due"),
  done: boolean("done").notNull().default(false),
  priority: text("priority").notNull().default("Medium"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Compliance ------------------------------------------------------------

export const complianceCheck = pgTable("compliance_check", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull().default("Monthly"),
  owner: text("owner"),
  lastDone: text("lastDone"),
  status: text("status").notNull().default("Due"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const certificate = pgTable("certificate", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  authority: text("authority"),
  expires: text("expires"),
  status: text("status").notNull().default("Valid"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const document = pgTable("document", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  updated: text("updated"),
  owner: text("owner"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Staff & Scheduling ---------------------------------------------------

export const staffMember = pgTable("staff_member", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Staff"),
  contract: text("contract").notNull().default("Full-time"),
  hoursWk: integer("hoursWk").notNull().default(0),
  status: text("status").notNull().default("Off"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const rotaShift = pgTable("rota_shift", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  weekStart: text("weekStart").notNull(),
  day: text("day").notNull(),
  shiftTime: text("shiftTime"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const leaveRequest = pgTable("leave_request", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Annual"),
  dates: text("dates").notNull(),
  days: integer("days").notNull().default(1),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const clockEvent = pgTable("clock_event", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  staffName: text("staffName").notNull(),
  type: text("type").notNull().default("in"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationLabel: text("locationLabel"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Financials -----------------------------------------------------------

export const expense = pgTable("expense", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  category: text("category").notNull(),
  vendor: text("vendor").notNull(),
  amountPence: integer("amountPence").notNull().default(0),
  date: text("date").notNull(),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const takings = pgTable("takings", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  dateISO: text("dateISO").notNull(),
  wetPence: integer("wetPence").notNull().default(0),
  foodPence: integer("foodPence").notNull().default(0),
  eventsPence: integer("eventsPence").notNull().default(0),
  retailPence: integer("retailPence").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export type Venue = typeof venue.$inferSelect
export type Member = typeof member.$inferSelect
export type DbAsset = typeof asset.$inferSelect
export type DbOrder = typeof order.$inferSelect
export type DbSupplier = typeof supplier.$inferSelect
export type DbMaintenance = typeof maintenance.$inferSelect
export type DbEvent = typeof venueEvent.$inferSelect
export type DbTask = typeof task.$inferSelect
export type DbComplianceCheck = typeof complianceCheck.$inferSelect
export type DbCertificate = typeof certificate.$inferSelect
export type DbDocument = typeof document.$inferSelect
export type DbStaffMember = typeof staffMember.$inferSelect
export type DbRotaShift = typeof rotaShift.$inferSelect
export type DbLeaveRequest = typeof leaveRequest.$inferSelect
export type DbClockEvent = typeof clockEvent.$inferSelect
export type DbExpense = typeof expense.$inferSelect
export type DbTakings = typeof takings.$inferSelect
