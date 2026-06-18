// Centralized mock data for the Tapsheet pub & hospitality operations platform.
// All figures are illustrative placeholders for the prototype.

export const venue = {
  name: "The Crown & Anchor",
  location: "Bristol, UK",
  manager: "Sarah Whitfield",
}

/* ----------------------------- Dashboard KPIs ----------------------------- */

export type Trend = "up" | "down" | "flat"

export interface Kpi {
  label: string
  value: string
  delta: string
  trend: Trend
  hint: string
}

export const dashboardKpis: Kpi[] = [
  { label: "Net revenue (wk)", value: "£42,180", delta: "+8.2%", trend: "up", hint: "vs last week" },
  { label: "Gross profit", value: "68.4%", delta: "+1.1pt", trend: "up", hint: "target 67%" },
  { label: "Labour cost", value: "29.1%", delta: "-0.6pt", trend: "down", hint: "of revenue" },
  { label: "Open tasks", value: "14", delta: "5 due today", trend: "flat", hint: "across team" },
]

export const revenueSeries = [
  { day: "Mon", revenue: 4200, target: 4000 },
  { day: "Tue", revenue: 3850, target: 4000 },
  { day: "Wed", revenue: 5100, target: 4500 },
  { day: "Thu", revenue: 6300, target: 5500 },
  { day: "Fri", revenue: 9450, target: 8500 },
  { day: "Sat", revenue: 10800, target: 9500 },
  { day: "Sun", revenue: 7480, target: 7000 },
]

export const salesMix = [
  { category: "Wet (drinks)", value: 58, fill: "var(--color-chart-1)" },
  { category: "Food", value: 31, fill: "var(--color-chart-2)" },
  { category: "Events", value: 7, fill: "var(--color-chart-4)" },
  { category: "Retail", value: 4, fill: "var(--color-chart-3)" },
]

export interface ActivityItem {
  id: string
  who: string
  action: string
  target: string
  time: string
  type: "order" | "task" | "compliance" | "staff" | "finance"
}

export const recentActivity: ActivityItem[] = [
  { id: "a1", who: "Tom B.", action: "completed", target: "Cellar line clean", time: "12m ago", type: "task" },
  { id: "a2", who: "System", action: "flagged", target: "Fire alarm test due in 3 days", time: "40m ago", type: "compliance" },
  { id: "a3", who: "Sarah W.", action: "approved", target: "Booker order #BK-2291", time: "1h ago", type: "order" },
  { id: "a4", who: "Priya N.", action: "requested", target: "Annual leave 24–26 Jun", time: "2h ago", type: "staff" },
  { id: "a5", who: "System", action: "recorded", target: "Card takings £6,420", time: "3h ago", type: "finance" },
  { id: "a6", who: "Dan O.", action: "logged", target: "Glasswasher fault — bar 2", time: "4h ago", type: "task" },
]

/* ------------------------------- Operations ------------------------------- */

export interface Order {
  id: string
  supplier: string
  items: number
  total: string
  status: "Draft" | "Submitted" | "Confirmed" | "Delivered"
  due: string
}

export const orders: Order[] = [
  { id: "BK-2291", supplier: "Booker Wholesale", items: 42, total: "£1,284.50", status: "Confirmed", due: "Tomorrow" },
  { id: "MD-1180", supplier: "Molson Coors", items: 18, total: "£2,910.00", status: "Submitted", due: "Thu 13 Jun" },
  { id: "FF-0934", supplier: "Fresh Fields Produce", items: 27, total: "£486.20", status: "Delivered", due: "Today" },
  { id: "BW-0421", supplier: "Bristol Wine Co.", items: 12, total: "£1,040.00", status: "Draft", due: "—" },
  { id: "CC-3302", supplier: "Coca-Cola HBC", items: 9, total: "£612.75", status: "Confirmed", due: "Fri 14 Jun" },
]

export interface Supplier {
  id: string
  name: string
  category: string
  terms: string
  spendMtd: string
  rating: number
}

export const suppliers: Supplier[] = [
  { id: "s1", name: "Booker Wholesale", category: "General / Dry goods", terms: "Net 14", spendMtd: "£8,420", rating: 4.6 },
  { id: "s2", name: "Molson Coors", category: "Draught & beer", terms: "Net 30", spendMtd: "£11,950", rating: 4.8 },
  { id: "s3", name: "Fresh Fields Produce", category: "Fresh produce", terms: "Net 7", spendMtd: "£3,180", rating: 4.2 },
  { id: "s4", name: "Bristol Wine Co.", category: "Wine & spirits", terms: "Net 30", spendMtd: "£5,640", rating: 4.5 },
]

export interface MaintenanceJob {
  id: string
  asset: string
  issue: string
  priority: "Low" | "Medium" | "High"
  assignee: string
  status: "Open" | "In progress" | "Resolved"
}

export const maintenanceJobs: MaintenanceJob[] = [
  { id: "m1", asset: "Glasswasher — Bar 2", issue: "Not reaching temperature", priority: "High", assignee: "Dan O.", status: "In progress" },
  { id: "m2", asset: "Cellar cooling", issue: "Routine service", priority: "Medium", assignee: "AceCool Ltd", status: "Open" },
  { id: "m3", asset: "Ladies WC tap", issue: "Dripping", priority: "Low", assignee: "Tom B.", status: "Open" },
  { id: "m4", asset: "Coffee machine", issue: "Descale & calibrate", priority: "Medium", assignee: "Priya N.", status: "Resolved" },
]

export interface EventItem {
  id: string
  name: string
  date: string
  covers: number
  status: "Confirmed" | "Provisional" | "Enquiry"
  owner: string
}

export const events: EventItem[] = [
  { id: "e1", name: "Saturday Live Music", date: "Sat 14 Jun", covers: 120, status: "Confirmed", owner: "Sarah W." },
  { id: "e2", name: "Hartley Wedding Reception", date: "Sat 21 Jun", covers: 80, status: "Provisional", owner: "Priya N." },
  { id: "e3", name: "Quiz Night", date: "Tue 17 Jun", covers: 60, status: "Confirmed", owner: "Tom B." },
  { id: "e4", name: "Corporate — Lockwood Ltd", date: "Thu 26 Jun", covers: 35, status: "Enquiry", owner: "Sarah W." },
]

export interface TaskItem {
  id: string
  title: string
  area: string
  assignee: string
  due: string
  done: boolean
  priority: "Low" | "Medium" | "High"
}

export const tasks: TaskItem[] = [
  { id: "t1", title: "Cellar line clean", area: "Cellar", assignee: "Tom B.", due: "Today", done: true, priority: "High" },
  { id: "t2", title: "Stock count — spirits", area: "Bar", assignee: "Priya N.", due: "Today", done: false, priority: "Medium" },
  { id: "t3", title: "Update specials board", area: "Front of house", assignee: "Mia L.", due: "Today", done: false, priority: "Low" },
  { id: "t4", title: "Deep clean kitchen extraction", area: "Kitchen", assignee: "Dan O.", due: "Tomorrow", done: false, priority: "High" },
  { id: "t5", title: "Bottle up fridges", area: "Bar", assignee: "Jack R.", due: "Today", done: false, priority: "Medium" },
]

/* ----------------------------- Asset tracking ----------------------------- */

export interface Asset {
  id: string // asset number
  name: string
  description: string
  category: "Bar" | "Cellar" | "Kitchen" | "Furniture" | "AV & Tech"
  serial: string
  price: number // GBP
  purchaseDate: string
  condition: "Excellent" | "Good" | "Fair" | "Needs repair"
  location: string
  photo: string
}

export const assets: Asset[] = [
  {
    id: "AST-001",
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
    id: "AST-002",
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
    id: "AST-003",
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
    id: "AST-004",
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
    id: "AST-005",
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
    id: "AST-006",
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
    id: "AST-007",
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
    id: "AST-008",
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

/* -------------------------------- Financials ------------------------------ */

export const plSeries = [
  { month: "Jan", revenue: 138000, costs: 104000 },
  { month: "Feb", revenue: 126000, costs: 99000 },
  { month: "Mar", revenue: 152000, costs: 112000 },
  { month: "Apr", revenue: 161000, costs: 118000 },
  { month: "May", revenue: 175000, costs: 124000 },
  { month: "Jun", revenue: 182000, costs: 127000 },
]

export const financialKpis: Kpi[] = [
  { label: "Revenue (MTD)", value: "£182,400", delta: "+6.4%", trend: "up", hint: "vs last month" },
  { label: "Net profit", value: "£55,300", delta: "+9.1%", trend: "up", hint: "30.3% margin" },
  { label: "Total expenses", value: "£127,100", delta: "+2.0%", trend: "down", hint: "controlled" },
  { label: "Target progress", value: "94%", delta: "£11k to go", trend: "flat", hint: "monthly target" },
]

export interface Expense {
  id: string
  category: string
  vendor: string
  amount: string
  date: string
  status: "Paid" | "Pending" | "Overdue"
}

export const expenses: Expense[] = [
  { id: "x1", category: "Stock — Drinks", vendor: "Molson Coors", amount: "£2,910.00", date: "10 Jun", status: "Pending" },
  { id: "x2", category: "Utilities", vendor: "British Gas", amount: "£1,840.00", date: "08 Jun", status: "Paid" },
  { id: "x3", category: "Stock — Food", vendor: "Fresh Fields", amount: "£486.20", date: "11 Jun", status: "Paid" },
  { id: "x4", category: "Maintenance", vendor: "AceCool Ltd", amount: "£320.00", date: "05 Jun", status: "Overdue" },
  { id: "x5", category: "Marketing", vendor: "Meta Ads", amount: "£250.00", date: "01 Jun", status: "Paid" },
]

export const expenseBreakdown = [
  { category: "Stock", value: 52, fill: "var(--color-chart-1)" },
  { category: "Labour", value: 29, fill: "var(--color-chart-2)" },
  { category: "Utilities", value: 9, fill: "var(--color-chart-3)" },
  { category: "Other", value: 10, fill: "var(--color-chart-4)" },
]

/* --------------------------- Staff & Scheduling --------------------------- */

export interface StaffMember {
  id: string
  name: string
  role: string
  contract: "Full-time" | "Part-time" | "Casual"
  hoursWk: number
  status: "On shift" | "Off" | "On leave"
}

export const staff: StaffMember[] = [
  { id: "u1", name: "Sarah Whitfield", role: "General Manager", contract: "Full-time", hoursWk: 45, status: "On shift" },
  { id: "u2", name: "Tom Barnes", role: "Assistant Manager", contract: "Full-time", hoursWk: 40, status: "On shift" },
  { id: "u3", name: "Priya Nair", role: "Head Chef", contract: "Full-time", hoursWk: 42, status: "Off" },
  { id: "u4", name: "Dan O'Connor", role: "Bar Supervisor", contract: "Part-time", hoursWk: 24, status: "On shift" },
  { id: "u5", name: "Mia Lewis", role: "Front of House", contract: "Casual", hoursWk: 16, status: "On leave" },
  { id: "u6", name: "Jack Reed", role: "Bartender", contract: "Part-time", hoursWk: 20, status: "Off" },
]

export const rotaDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export interface Shift {
  staff: string
  shifts: (string | null)[] // per day
}

export const rota: Shift[] = [
  { staff: "Sarah Whitfield", shifts: ["09–17", "09–17", null, "12–22", "12–22", "12–23", null] },
  { staff: "Tom Barnes", shifts: ["12–22", null, "12–22", "12–22", null, "16–00", "12–22"] },
  { staff: "Dan O'Connor", shifts: [null, "17–23", "17–23", null, "17–01", "17–01", "16–22"] },
  { staff: "Mia Lewis", shifts: [null, null, null, "17–23", "17–23", "17–01", null] },
  { staff: "Jack Reed", shifts: ["17–23", "17–23", null, null, "17–01", "17–01", null] },
]

export interface LeaveRequest {
  id: string
  name: string
  type: "Annual" | "Sick" | "Unpaid"
  dates: string
  days: number
  status: "Approved" | "Pending" | "Declined"
}

export const leaveRequests: LeaveRequest[] = [
  { id: "l1", name: "Priya Nair", type: "Annual", dates: "24–26 Jun", days: 3, status: "Pending" },
  { id: "l2", name: "Jack Reed", type: "Annual", dates: "01–07 Jul", days: 5, status: "Approved" },
  { id: "l3", name: "Mia Lewis", type: "Sick", dates: "11 Jun", days: 1, status: "Approved" },
  { id: "l4", name: "Tom Barnes", type: "Annual", dates: "15–16 Jul", days: 2, status: "Pending" },
]

/* -------------------------------- Compliance ------------------------------ */

export const complianceKpis: Kpi[] = [
  { label: "Compliance score", value: "92%", delta: "+3pt", trend: "up", hint: "all areas" },
  { label: "Checks due (7d)", value: "6", delta: "2 overdue", trend: "flat", hint: "this week" },
  { label: "Valid certificates", value: "11/12", delta: "1 expiring", trend: "down", hint: "renew soon" },
  { label: "Last audit", value: "5★", delta: "Food hygiene", trend: "up", hint: "Apr 2026" },
]

export interface ComplianceCheck {
  id: string
  name: string
  frequency: string
  owner: string
  lastDone: string
  status: "Complete" | "Due" | "Overdue"
}

export const complianceChecks: ComplianceCheck[] = [
  { id: "c1", name: "Fire alarm test", frequency: "Weekly", owner: "Tom B.", lastDone: "31 May", status: "Due" },
  { id: "c2", name: "Cellar temperature log", frequency: "Daily", owner: "Dan O.", lastDone: "Today", status: "Complete" },
  { id: "c3", name: "Fridge temperature check", frequency: "Daily", owner: "Priya N.", lastDone: "Today", status: "Complete" },
  { id: "c4", name: "Emergency lighting test", frequency: "Monthly", owner: "Tom B.", lastDone: "02 May", status: "Overdue" },
  { id: "c5", name: "First aid kit check", frequency: "Monthly", owner: "Mia L.", lastDone: "20 May", status: "Due" },
  { id: "c6", name: "Allergen matrix review", frequency: "Quarterly", owner: "Priya N.", lastDone: "01 Apr", status: "Complete" },
]

export interface Certificate {
  id: string
  name: string
  authority: string
  expires: string
  status: "Valid" | "Expiring" | "Expired"
}

export const certificates: Certificate[] = [
  { id: "cert1", name: "Premises Licence", authority: "Bristol City Council", expires: "—", status: "Valid" },
  { id: "cert2", name: "Food Hygiene Rating", authority: "FSA", expires: "Apr 2027", status: "Valid" },
  { id: "cert3", name: "Public Liability Insurance", authority: "Aviva", expires: "30 Jun 2026", status: "Expiring" },
  { id: "cert4", name: "PAT Testing", authority: "SafeTest Ltd", expires: "Sep 2026", status: "Valid" },
  { id: "cert5", name: "Gas Safety Certificate", authority: "Gas Safe", expires: "Nov 2026", status: "Valid" },
]

export interface Document {
  id: string
  name: string
  category: string
  updated: string
  owner: string
}

export const documents: Document[] = [
  { id: "d1", name: "Fire Risk Assessment.pdf", category: "Health & Safety", updated: "12 Apr 2026", owner: "Sarah W." },
  { id: "d2", name: "Cellar Management SOP.pdf", category: "Operations", updated: "28 Mar 2026", owner: "Dan O." },
  { id: "d3", name: "Staff Handbook 2026.pdf", category: "HR", updated: "02 Jan 2026", owner: "Sarah W." },
  { id: "d4", name: "Allergen Matrix.xlsx", category: "Food Safety", updated: "01 Apr 2026", owner: "Priya N." },
  { id: "d5", name: "Licensing Objectives.pdf", category: "Licensing", updated: "15 Feb 2026", owner: "Sarah W." },
]
