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
  // Per-user personal preferences as JSON (e.g. staff's own hidden sidebar modules).
  preferences: text("preferences").notNull().default("{}"),
  // When set, the account is deactivated: existing sessions are revoked and the
  // user is blocked from signing in until an admin reactivates them.
  disabledAt: timestamp("disabledAt"),
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
  // JSON-encoded { order: string[]; hidden: string[] } for the owner's
  // customizable dashboard (section order + hidden sections).
  dashboardLayout: text("dashboardLayout").notNull().default("{}"),
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

// A "business" is a separate data scope owned by a login. One email/login can
// own several businesses; the active one is selected via cookie. Every app
// table keys off `userId`, which equals the active business's `scopeId`.
export const business = pgTable("business", {
  id: serial("id").primaryKey(),
  // The data-scope id written into every table's `userId` column for this business.
  scopeId: text("scopeId").notNull().unique(),
  // The login (user.id) that owns and can switch into this business.
  ownerUserId: text("ownerUserId").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
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
  // Optional link to a specific asset in the asset register.
  assetId: integer("assetId"),
  issue: text("issue"),
  priority: text("priority").notNull().default("Medium"),
  assignee: text("assignee"),
  status: text("status").notNull().default("Open"),
  costPence: integer("costPence").notNull().default(0),
  // Human-facing display date the work was logged (e.g. "14 Mar 2024").
  loggedDate: text("loggedDate"),
  // ISO date (YYYY-MM-DD) of the fault/scheduled service, used to sync the
  // job onto the calendar.
  scheduledDate: text("scheduledDate"),
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

// Calendar entries, scoped per venue (location). A calendar event can optionally
// link to an existing operations event, task, task-check or corrective action via
// `linkType` + `linkId`, so dated work and bookings surface on one shared calendar.
export const calendarEvent = pgTable("calendar_event", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // Start date as ISO YYYY-MM-DD (always machine-parseable for the grid).
  date: text("date").notNull(),
  endDate: text("endDate"),
  startTime: text("startTime"),
  endTime: text("endTime"),
  allDay: boolean("allDay").notNull().default(true),
  // "event" | "task" | "booking" | "maintenance" | "reminder"
  type: text("type").notNull().default("event"),
  // "blue" | "amber" | "gold" | "red" | "slate"
  color: text("color").notNull().default("blue"),
  location: text("location"),
  // When set, the entry mirrors another record: "event" | "task" | "taskCheck" | "correctiveAction".
  linkType: text("linkType"),
  linkId: integer("linkId"),
  status: text("status").notNull().default("Scheduled"),
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
  // Set when this shift was generated from a recurring shift pattern.
  patternId: integer("patternId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A future-dated request to auto-publish a venue's rota for a given week. A cron
// job (and a page-load fallback) flips due jobs to "done", publishing the week's
// draft shifts and notifying staff. Status: "pending" | "done" | "cancelled".
export const scheduledPublish = pgTable("scheduled_publish", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  weekStart: text("weekStart").notNull(),
  publishAt: timestamp("publishAt").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  processedAt: timestamp("processedAt"),
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

// Recurring shift template: auto-generates draft shifts into matching weeks.
export const shiftPattern = pgTable("shift_pattern", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  // 0 = recurring open shift; otherwise the staff member it repeats for.
  staffMemberId: integer("staffMemberId").notNull().default(0),
  day: text("day").notNull(),
  role: text("role"),
  startTime: text("startTime"),
  endTime: text("endTime"),
  color: text("color").default("green"),
  breakMins: integer("breakMins").notNull().default(0),
  notes: text("notes"),
  payRatePence: integer("payRatePence").notNull().default(0),
  // Repeat cadence in weeks (1 = weekly, 2 = fortnightly, ...).
  repeatWeeks: integer("repeatWeeks").notNull().default(1),
  // The weekStart this pattern begins from; cadence is measured from here.
  anchorWeek: text("anchorWeek").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A named, reusable week of shifts that can be applied to any week.
export const rotaTemplate = pgTable("rota_template", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const rotaTemplateShift = pgTable("rota_template_shift", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  templateId: integer("templateId").notNull(),
  staffMemberId: integer("staffMemberId").notNull().default(0),
  day: text("day").notNull(),
  role: text("role"),
  startTime: text("startTime"),
  endTime: text("endTime"),
  color: text("color").default("green"),
  breakMins: integer("breakMins").notNull().default(0),
  notes: text("notes"),
  payRatePence: integer("payRatePence").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A to-do attached to a specific rota shift, visible to the assigned staff.
export const shiftTask = pgTable("shift_task", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  shiftId: integer("shiftId").notNull(),
  label: text("label").notNull(),
  done: boolean("done").notNull().default(false),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Task Management -------------------------------------------------------

export const taskCheck = pgTable("task_check", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Checklist"),
  // Legacy free-text assignee, kept for display/back-compat.
  assignee: text("assignee"),
  // Linked staff member this task is assigned to (null = unassigned/role-based).
  assigneeStaffId: integer("assigneeStaffId"),
  // Role this task is assigned to, e.g. "Bar" (null = none).
  assigneeRole: text("assigneeRole"),
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
  // Recurrence: a template row (recurring=true) auto-spawns dated instances.
  recurring: boolean("recurring").notNull().default(false),
  // Set on generated instances; points at the template's id.
  recurrenceParentId: integer("recurrenceParentId"),
  // Last period date a template generated an instance for (YYYY-MM-DD).
  lastGeneratedDate: text("lastGeneratedDate"),
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

// Business meetings held with venue operators. A meeting captures shared notes,
// a signature review for accountability, and links to trackable follow-up actions.
export const meeting = pgTable("meeting", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  title: text("title").notNull(),
  scheduledDate: text("scheduledDate"),
  createdBy: text("createdBy"),
  // "Pending" | "Held" | "Completed" | "Actions Overdue" | "Review Overdue"
  status: text("status").notNull().default("Pending"),
  notes: text("notes"),
  // Data-URL / blob of the captured signature review.
  signatureUrl: text("signatureUrl"),
  signedBy: text("signedBy"),
  signedAt: timestamp("signedAt"),
  reviewedAt: timestamp("reviewedAt"),
  heldAt: timestamp("heldAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A follow-up action agreed in a meeting; tracked to completion.
export const meetingAction = pgTable("meeting_action", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  meetingId: integer("meetingId").notNull(),
  title: text("title").notNull(),
  assignee: text("assignee"),
  dueDate: text("dueDate"),
  // "Open" | "Completed" | "Overdue"
  status: text("status").notNull().default("Open"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A recorded utility meter reading (gas/electric/water) for a venue.
export const meterReading = pgTable("meter_reading", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  meterType: text("meterType").notNull().default("Electric"),
  unit: text("unit").notNull().default("kWh"),
  value: doublePrecision("value").notNull().default(0),
  readingDate: text("readingDate").notNull(),
  recordedBy: text("recordedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Document store. venueId 0 = stored centrally (company-wide); otherwise the
// document belongs to a specific venue. Categorised, shareable and with an
// optional expiry/reminder date for certificates that must be renewed.
export const opsDocument = pgTable("ops_document", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull().default(0),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("General"),
  fileUrl: text("fileUrl"),
  expires: text("expires"),
  sharedWith: text("sharedWith").notNull().default("All Venue Staff"),
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

// --- Training -------------------------------------------------------------

// A training module is a course grouped under a category (e.g. Cellar
// Management, Food Training). It contains ordered lessons (videos + documents)
// and is business-wide (account scoped) so it applies across venues.
export const trainingModule = pgTable("training_module", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("General"),
  coverImage: text("coverImage"),
  status: text("status").notNull().default("Published"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A lesson is a single learning item within a module: a "video" (external
// link) or a "document" (rich text to read, optionally with a link).
export const trainingLesson = pgTable("training_lesson", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  moduleId: integer("moduleId").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("video"),
  url: text("url"),
  content: text("content"),
  durationMin: integer("durationMin"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Assigns a module to an audience group (everyone/kitchen/bar/foh/management)
// and/or a specific staff member. Multiple rows can target the same module.
export const trainingAssignment = pgTable("training_assignment", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  moduleId: integer("moduleId").notNull(),
  audience: text("audience").notNull().default("everyone"),
  staffMemberId: integer("staffMemberId"),
  dueDate: text("dueDate"),
  assignedBy: text("assignedBy"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A per-staff, per-lesson completion record. Presence of a row = completed.
export const trainingProgress = pgTable("training_progress", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  moduleId: integer("moduleId").notNull(),
  lessonId: integer("lessonId").notNull(),
  completed: boolean("completed").notNull().default(true),
  completedAt: timestamp("completedAt").notNull().defaultNow(),
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
  // Synced card sales pulled from Square (separate from manual categories).
  squarePence: integer("squarePence").notNull().default(0),
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

// --- Budgets / targets -----------------------------------------------------

// Per-venue performance targets used for the traffic-light system. All money
// values are stored in pence; percentages are whole numbers (e.g. 70 = 70%).
export const budget = pgTable("budget", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  weeklySalesPence: integer("weeklySalesPence"),
  monthlySalesPence: integer("monthlySalesPence"),
  labourPctTarget: integer("labourPctTarget"),
  gpPctTarget: integer("gpPctTarget"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export type DbBudget = typeof budget.$inferSelect

// --- HR: Onboarding, documents & checklist --------------------------------
// UK payroll onboarding record. One row per staff member. Sensitive statutory
// fields (NI number, bank details, HMRC starter declaration) live here so the
// team directory stays lightweight. Money values are stored in pence.
export const onboarding = pgTable("onboarding", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),

  // Personal / legal identity
  legalFirstName: text("legalFirstName"),
  legalLastName: text("legalLastName"),
  preferredName: text("preferredName"),
  dob: text("dob"),
  nationality: text("nationality"),

  // Home address
  addressLine1: text("addressLine1"),
  addressLine2: text("addressLine2"),
  city: text("city"),
  postcode: text("postcode"),
  personalEmail: text("personalEmail"),
  personalPhone: text("personalPhone"),

  // Right to Work (UK immigration compliance)
  nationalInsuranceNumber: text("nationalInsuranceNumber"),
  rightToWorkType: text("rightToWorkType"), // "passport" | "share_code" | "brp" | "other"
  rightToWorkShareCode: text("rightToWorkShareCode"),
  rightToWorkDocUrl: text("rightToWorkDocUrl"),
  rightToWorkExpiry: text("rightToWorkExpiry"),
  rightToWorkChecked: boolean("rightToWorkChecked").notNull().default(false),

  // HMRC New Starter Checklist
  starterDeclaration: text("starterDeclaration"), // "A" | "B" | "C"
  studentLoanPlan: text("studentLoanPlan").notNull().default("none"), // none|plan1|plan2|plan4
  postgradLoan: boolean("postgradLoan").notNull().default(false),
  taxCode: text("taxCode"),

  // Bank details for payroll
  bankName: text("bankName"),
  accountName: text("accountName"),
  sortCode: text("sortCode"),
  accountNumber: text("accountNumber"),

  // Pension auto-enrolment
  pensionOptOut: boolean("pensionOptOut").notNull().default(false),

  // Emergency contact
  emergencyName: text("emergencyName"),
  emergencyRelationship: text("emergencyRelationship"),
  emergencyPhone: text("emergencyPhone"),

  // Employment terms
  jobTitle: text("jobTitle"),
  startDate: text("startDate"),
  payType: text("payType").notNull().default("hourly"), // "hourly" | "salary"
  payRatePence: integer("payRatePence").notNull().default(0),
  holidayEntitlementDays: integer("holidayEntitlementDays").notNull().default(28),
  probationEndDate: text("probationEndDate"),
  reviewDueDate: text("reviewDueDate"),

  // Workflow status: not_started | in_progress | submitted | approved
  status: text("status").notNull().default("not_started"),
  submittedAt: timestamp("submittedAt"),
  approvedAt: timestamp("approvedAt"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// HR document vault with optional expiry tracking (contracts, RTW evidence,
// certifications). staffMemberId 0 = company-wide document.
export const hrDocument = pgTable("hr_document", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull().default(0),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"), // contract|rtw|certification|policy|other
  fileUrl: text("fileUrl"),
  issuedDate: text("issuedDate"),
  expiryDate: text("expiryDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Per-hire onboarding checklist items. Seeded with a default UK template when
// an onboarding record is created, then toggled as each step completes.
export const onboardingTask = pgTable("onboarding_task", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  venueId: integer("venueId").notNull(),
  staffMemberId: integer("staffMemberId").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull().default("general"),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("doneAt"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export type DbOnboarding = typeof onboarding.$inferSelect
export type DbHrDocument = typeof hrDocument.$inferSelect
export type DbOnboardingTask = typeof onboardingTask.$inferSelect

export type Venue = typeof venue.$inferSelect
export type Company = typeof company.$inferSelect
export type Member = typeof member.$inferSelect
export type DbAsset = typeof asset.$inferSelect
export type DbOrder = typeof order.$inferSelect
export type DbSupplier = typeof supplier.$inferSelect
export type DbMaintenance = typeof maintenance.$inferSelect
export type DbEvent = typeof venueEvent.$inferSelect
export type DbCalendarEvent = typeof calendarEvent.$inferSelect
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
export type DbShiftPattern = typeof shiftPattern.$inferSelect
export type DbRotaTemplate = typeof rotaTemplate.$inferSelect
export type DbRotaTemplateShift = typeof rotaTemplateShift.$inferSelect
export type DbShiftTask = typeof shiftTask.$inferSelect
export type DbExpense = typeof expense.$inferSelect
export type DbTakings = typeof takings.$inferSelect
export type DbTaskCheck = typeof taskCheck.$inferSelect
export type DbTaskCheckItem = typeof taskCheckItem.$inferSelect
export type DbCorrectiveAction = typeof correctiveAction.$inferSelect
export type DbMeeting = typeof meeting.$inferSelect
export type DbMeetingAction = typeof meetingAction.$inferSelect
export type DbMeterReading = typeof meterReading.$inferSelect
export type DbTrainingModule = typeof trainingModule.$inferSelect
export type DbTrainingLesson = typeof trainingLesson.$inferSelect
export type DbTrainingAssignment = typeof trainingAssignment.$inferSelect
export type DbTrainingProgress = typeof trainingProgress.$inferSelect
export type DbOpsDocument = typeof opsDocument.$inferSelect
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
