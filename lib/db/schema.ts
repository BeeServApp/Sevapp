import { pgTable, text, timestamp, boolean, serial, integer, doublePrecision } from "drizzle-orm/pg-core"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  // App-level role: "owner" (full access) or "staff" (scheduling + tasks only).
  appRole: text("appRole").notNull().default("owner"),
  // For staff accounts: the owner whose data this user reads, and the linked staff record.
  ownerId: text("ownerId"),
  staffMemberId: integer("staffMemberId"),
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
  postcode: text("postcode"),
  phone: text("phone"),
  email: text("email"),
  managerName: text("managerName"),
  capacity: integer("capacity"),
  floors: integer("floors"),
  licenseNumber: text("licenseNumber"),
  licenseType: text("licenseType"),
  // JSON-encoded array of { day, open, close, closed } objects.
  openingHours: text("openingHours"),
  status: text("status").notNull().default("Active"),
  openingDate: text("openingDate"),
  notes: text("notes"),
  // Square integration: the mapped Square location id for this venue (if any).
  // The human-readable name is resolved live from the Square API.
  squareLocationId: text("squareLocationId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Company-level settings, one row per account owner (scoped by userId).
export const company = pgTable("company", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull().default(""),
  tradingName: text("tradingName"),
  logo: text("logo"),
  registrationNumber: text("registrationNumber"),
  vatNumber: text("vatNumber"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country").default("United Kingdom"),
  brandColor: text("brandColor").default("#16a34a"),
  currency: text("currency").notNull().default("GBP"),
  timezone: text("timezone").notNull().default("Europe/London"),
  financialYearStart: text("financialYearStart").notNull().default("April"),
  dateFormat: text("dateFormat").notNull().default("DD/MM/YYYY"),
  // JSON-encoded arrays of hidden sidebar module hrefs / settings tab ids.
  hiddenModules: text("hiddenModules").notNull().default("[]"),
  hiddenSettingsTabs: text("hiddenSettingsTabs").notNull().default("[]"),
  // Stripe subscription / billing state. Pricing is per-location (per venue).
  subscriptionPlan: text("subscriptionPlan"),
  subscriptionStatus: text("subscriptionStatus").notNull().default("none"),
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  subscriptionQuantity: integer("subscriptionQuantity"),
  trialEndsAt: timestamp("trialEndsAt"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// One Square OAuth connection per account owner (scoped by accountId).
// Access/refresh tokens are stored AES-256-GCM encrypted; never sent to the client.
export const squareConnection = pgTable("square_connection", {
  id: serial("id").primaryKey(),
  accountId: text("accountId").notNull(),
  merchantId: text("merchantId"),
  merchantName: text("merchantName"),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  scopes: text("scopes"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
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
  email: text("email"),
  phone: text("phone"),
  // The user.id of the staff login account linked to this record (once accepted).
  linkedUserId: text("linkedUserId"),
  // Commission as a whole-number percent of attributed sales (0 = none).
  commissionPct: integer("commissionPct").notNull().default(0),
  // Default hourly pay rate, pre-filled into new shifts and timecards.
  defaultPayRatePence: integer("defaultPayRatePence").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const rotaShift = pgTable("rota_shift", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  // 0 = unassigned "open shift"; otherwise the staff member it's assigned to.
  staffMemberId: integer("staffMemberId").notNull(),
  weekStart: text("weekStart").notNull(),
  day: text("day").notNull(),
  // Legacy free-text time; new shifts use startTime/endTime.
  shiftTime: text("shiftTime"),
  role: text("role"),
  startTime: text("startTime"),
  endTime: text("endTime"),
  color: text("color").default("green"),
  breakMins: integer("breakMins").notNull().default(0),
  notes: text("notes"),
  payRatePence: integer("payRatePence").notNull().default(0),
  // "draft" until the rota is published, then "published".
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Invite links that let a staff member create a login bound to their rota record.
export const staffInvite = pgTable("staff_invite", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  token: text("token").notNull().unique(),
  email: text("email"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// In-app notifications. `userId` = owner/account, `recipientUserId` = who sees it.
export const notification = pgTable("notification", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  recipientUserId: text("recipientUserId").notNull(),
  staffMemberId: integer("staffMemberId"),
  kind: text("kind").notNull().default("shift"),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Change feed used to drive real-time SSE updates per account.
export const accountEvent = pgTable("account_event", {
  id: serial("id").primaryKey(),
  accountId: text("accountId").notNull(),
  channel: text("channel").notNull().default("all"),
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

// Per-account scheduling rules: overtime thresholds, clock-in protection, tips.
export const schedulingSettings = pgTable("scheduling_settings", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  overtimeWeeklyHours: integer("overtimeWeeklyHours").notNull().default(40),
  overtimeDailyHours: integer("overtimeDailyHours").notNull().default(0),
  clockInGraceMins: integer("clockInGraceMins").notNull().default(5),
  warnUnscheduled: boolean("warnUnscheduled").notNull().default(true),
  tipPooling: boolean("tipPooling").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Weekly recurring availability per staff member (status per day, optional window).
export const availability = pgTable("availability", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  day: text("day").notNull(),
  // "available" | "unavailable" | "preferred"
  status: text("status").notNull().default("available"),
  startTime: text("startTime"),
  endTime: text("endTime"),
  note: text("note"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Staff-initiated swap / drop / claim requests; owner approves.
export const shiftSwap = pgTable("shift_swap", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  shiftId: integer("shiftId").notNull(),
  requesterStaffId: integer("requesterStaffId").notNull(),
  // null = give-away/drop to the open pool; otherwise the proposed cover.
  targetStaffId: integer("targetStaffId"),
  // "drop" | "swap" | "claim"
  type: text("type").notNull().default("drop"),
  // "pending" | "approved" | "declined" | "cancelled"
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Editable timecards generated from clock events (or added manually).
export const timecard = pgTable("timecard", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  staffName: text("staffName").notNull(),
  dateISO: text("dateISO").notNull(),
  clockIn: text("clockIn"),
  clockOut: text("clockOut"),
  breakMins: integer("breakMins").notNull().default(0),
  payRatePence: integer("payRatePence").notNull().default(0),
  // "open" | "approved"
  status: text("status").notNull().default("open"),
  // "clock" | "manual"
  source: text("source").notNull().default("clock"),
  note: text("note"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Tips: assigned to an individual or pooled across the team for a date.
export const tipEntry = pgTable("tip_entry", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  dateISO: text("dateISO").notNull(),
  // null = pooled across staff who worked that day.
  staffMemberId: integer("staffMemberId"),
  amountPence: integer("amountPence").notNull().default(0),
  // "cash" | "card"
  method: text("method").notNull().default("cash"),
  pooled: boolean("pooled").notNull().default(false),
  note: text("note"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Task Management -------------------------------------------------------

export const taskCheck = pgTable("task_check", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Checklist"),
  assignee: text("assignee"),
  dueDate: text("dueDate"),
  dueTime: text("dueTime"),
  frequency: text("frequency").notNull().default("Daily"),
  priority: text("priority").notNull().default("Medium"),
  requiresPhoto: boolean("requiresPhoto").notNull().default(false),
  status: text("status").notNull().default("Pending"),
  notes: text("notes"),
  photoUrl: text("photoUrl"),
  completedBy: text("completedBy"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const taskCheckItem = pgTable("task_check_item", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  taskId: integer("taskId").notNull(),
  label: text("label").notNull(),
  done: boolean("done").notNull().default(false),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const correctiveAction = pgTable("corrective_action", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sourceTaskId: integer("sourceTaskId"),
  sourceAuditId: integer("sourceAuditId"),
  priority: text("priority").notNull().default("Medium"),
  assignee: text("assignee"),
  dueDate: text("dueDate"),
  status: text("status").notNull().default("Open"),
  photoUrl: text("photoUrl"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Safety Management -----------------------------------------------------

export const safetyRecord = pgTable("safety_record", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  module: text("module").notNull().default("Fire Safety"),
  name: text("name").notNull(),
  reference: text("reference"),
  owner: text("owner"),
  frequency: text("frequency").notNull().default("Annual"),
  lastDone: text("lastDone"),
  nextDue: text("nextDue"),
  status: text("status").notNull().default("Due"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const riskAssessment = pgTable("risk_assessment", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  area: text("area"),
  assessor: text("assessor"),
  reviewDate: text("reviewDate"),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const riskHazard = pgTable("risk_hazard", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  assessmentId: integer("assessmentId").notNull(),
  hazard: text("hazard").notNull(),
  whoAtRisk: text("whoAtRisk"),
  likelihood: integer("likelihood").notNull().default(1),
  severity: integer("severity").notNull().default(1),
  controls: text("controls"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const staffPolicy = pgTable("staff_policy", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("General"),
  version: text("version").notNull().default("1.0"),
  reviewDate: text("reviewDate"),
  fileUrl: text("fileUrl"),
  content: text("content"),
  status: text("status").notNull().default("Published"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const policyAck = pgTable("policy_ack", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  policyId: integer("policyId").notNull(),
  staffName: text("staffName").notNull(),
  acknowledgedAt: timestamp("acknowledgedAt").notNull().defaultNow(),
})

export const dailyChecklist = pgTable("daily_checklist", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  module: text("module").notNull().default("Opening"),
  timeOfDay: text("timeOfDay"),
  frequency: text("frequency").notNull().default("Daily"),
  items: text("items"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const dailyChecklistRun = pgTable("daily_checklist_run", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  checklistId: integer("checklistId").notNull(),
  dateISO: text("dateISO").notNull(),
  completedItems: text("completedItems"),
  totalItems: integer("totalItems").notNull().default(0),
  doneCount: integer("doneCount").notNull().default(0),
  status: text("status").notNull().default("Pending"),
  completedBy: text("completedBy"),
  notes: text("notes"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  module: text("module").notNull().default("H&S"),
  auditor: text("auditor"),
  auditDate: text("auditDate"),
  score: integer("score"),
  maxScore: integer("maxScore").notNull().default(100),
  findings: text("findings"),
  status: text("status").notNull().default("Scheduled"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Food Safety (HACCP) ---------------------------------------------------

export const foodCheck = pgTable("food_check", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  area: text("area").notNull().default("Fridge"),
  type: text("type").notNull().default("Temperature"),
  minTemp: integer("minTemp"),
  maxTemp: integer("maxTemp"),
  frequency: text("frequency").notNull().default("Daily"),
  timeOfDay: text("timeOfDay"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const foodCheckLog = pgTable("food_check_log", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  checkId: integer("checkId").notNull(),
  dateISO: text("dateISO").notNull(),
  tempReading: integer("tempReading"),
  passed: boolean("passed").notNull().default(true),
  correctiveAction: text("correctiveAction"),
  loggedBy: text("loggedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const foodPolicy = pgTable("food_policy", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("HACCP"),
  version: text("version").notNull().default("1.0"),
  reviewDate: text("reviewDate"),
  fileUrl: text("fileUrl"),
  content: text("content"),
  status: text("status").notNull().default("Published"),
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

// --- Gaming machines (UK Machine Games Duty) -------------------------------

export const gamingMachine = pgTable("gaming_machine", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  siteCode: text("siteCode"),
  machineType: text("machineType").notNull().default("AWP"),
  mgdBand: text("mgdBand").notNull().default("Standard"),
  locationSharePct: integer("locationSharePct").notNull().default(50),
  assetId: integer("assetId"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const gamingEntry = pgTable("gaming_entry", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  machineId: integer("machineId").notNull(),
  collectionDateISO: text("collectionDateISO").notNull(),
  days: integer("days").notNull().default(0),
  totalIncomePence: integer("totalIncomePence").notNull().default(0),
  refillsPence: integer("refillsPence").notNull().default(0),
  netPence: integer("netPence").notNull().default(0),
  mgdRateBps: integer("mgdRateBps").notNull().default(2000),
  mgdPence: integer("mgdPence").notNull().default(0),
  locationSharePct: integer("locationSharePct").notNull().default(50),
  locationSharePence: integer("locationSharePence").notNull().default(0),
  supplierSharePence: integer("supplierSharePence").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export type Venue = typeof venue.$inferSelect
export type Company = typeof company.$inferSelect
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
export type DbStaffInvite = typeof staffInvite.$inferSelect
export type DbNotification = typeof notification.$inferSelect
export type DbLeaveRequest = typeof leaveRequest.$inferSelect
export type DbClockEvent = typeof clockEvent.$inferSelect
export type DbSchedulingSettings = typeof schedulingSettings.$inferSelect
export type DbAvailability = typeof availability.$inferSelect
export type DbShiftSwap = typeof shiftSwap.$inferSelect
export type DbTimecard = typeof timecard.$inferSelect
export type DbTipEntry = typeof tipEntry.$inferSelect
export type DbExpense = typeof expense.$inferSelect
export type DbTakings = typeof takings.$inferSelect
export type DbTaskCheck = typeof taskCheck.$inferSelect
export type DbTaskCheckItem = typeof taskCheckItem.$inferSelect
export type DbCorrectiveAction = typeof correctiveAction.$inferSelect
export type DbSafetyRecord = typeof safetyRecord.$inferSelect
export type DbRiskAssessment = typeof riskAssessment.$inferSelect
export type DbRiskHazard = typeof riskHazard.$inferSelect
export type DbStaffPolicy = typeof staffPolicy.$inferSelect
export type DbPolicyAck = typeof policyAck.$inferSelect
export type DbDailyChecklist = typeof dailyChecklist.$inferSelect
export type DbDailyChecklistRun = typeof dailyChecklistRun.$inferSelect
export type DbAudit = typeof audit.$inferSelect
export type DbFoodCheck = typeof foodCheck.$inferSelect
export type DbFoodCheckLog = typeof foodCheckLog.$inferSelect
export type DbFoodPolicy = typeof foodPolicy.$inferSelect
export type DbGamingMachine = typeof gamingMachine.$inferSelect
export type DbGamingEntry = typeof gamingEntry.$inferSelect
