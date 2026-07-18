import { Client } from "pg"

const client = new Client({ connectionString: process.env.DATABASE_URL })

await client.connect()
await client.query(`
  ALTER TABLE task_check
  ADD COLUMN IF NOT EXISTS "sourceSafetyRecordId" integer
`)
console.log("Added task_check.sourceSafetyRecordId")
await client.end()
