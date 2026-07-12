import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const sql = `
CREATE TABLE IF NOT EXISTS "stock_product" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "venueId" integer NOT NULL,
  "name" text NOT NULL,
  "sku" text,
  "barcode" text,
  "category" text NOT NULL DEFAULT 'General',
  "unit" text NOT NULL DEFAULT 'each',
  "packSize" integer NOT NULL DEFAULT 1,
  "supplierId" integer,
  "costPricePence" integer NOT NULL DEFAULT 0,
  "salePricePence" integer NOT NULL DEFAULT 0,
  "vatRatePct" integer NOT NULL DEFAULT 20,
  "parLevel" double precision NOT NULL DEFAULT 0,
  "onHandQty" double precision NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "stock_order_item" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "orderId" integer NOT NULL,
  "productId" integer,
  "name" text NOT NULL,
  "qty" double precision NOT NULL DEFAULT 0,
  "unitCostPence" integer NOT NULL DEFAULT 0,
  "linePence" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "stock_count" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "venueId" integer NOT NULL,
  "reference" text NOT NULL,
  "area" text,
  "status" text NOT NULL DEFAULT 'In progress',
  "countedBy" text,
  "notes" text,
  "expectedValuePence" integer NOT NULL DEFAULT 0,
  "countedValuePence" integer NOT NULL DEFAULT 0,
  "varianceValuePence" integer NOT NULL DEFAULT 0,
  "startedAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "stock_count_item" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "countId" integer NOT NULL,
  "productId" integer NOT NULL,
  "name" text NOT NULL,
  "expectedQty" double precision NOT NULL DEFAULT 0,
  "countedQty" double precision NOT NULL DEFAULT 0,
  "unitCostPence" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "stock_product_scope_idx" ON "stock_product" ("userId", "venueId");
CREATE INDEX IF NOT EXISTS "stock_order_item_order_idx" ON "stock_order_item" ("userId", "orderId");
CREATE INDEX IF NOT EXISTS "stock_count_scope_idx" ON "stock_count" ("userId", "venueId");
CREATE INDEX IF NOT EXISTS "stock_count_item_count_idx" ON "stock_count_item" ("userId", "countId");
`

try {
  await pool.query(sql)
  console.log("[v0] Stock tables created (or already existed).")
} catch (err) {
  console.error("[v0] Failed to create stock tables:", err)
  process.exitCode = 1
} finally {
  await pool.end()
}
