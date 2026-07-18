import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_transfer (
      id serial PRIMARY KEY,
      "userId" text NOT NULL,
      "fromVenueId" integer NOT NULL,
      "toVenueId" integer NOT NULL,
      "fromProductId" integer NOT NULL,
      "toProductId" integer,
      "productName" text NOT NULL,
      qty double precision NOT NULL DEFAULT 0,
      "unitCostPence" integer NOT NULL DEFAULT 0,
      "valuePence" integer NOT NULL DEFAULT 0,
      note text,
      "movedBy" text,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `)
  console.log("[v0] stock_transfer table ready")
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
