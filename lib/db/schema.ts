import { pgTable, text, timestamp, boolean, serial, integer } from "drizzle-orm/pg-core"

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

export type Venue = typeof venue.$inferSelect
export type Member = typeof member.$inferSelect
export type DbAsset = typeof asset.$inferSelect
