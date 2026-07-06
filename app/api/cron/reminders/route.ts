import { NextResponse } from "next/server"
import { runDueReminders } from "@/app/actions/reminders"

// Node runtime (web-push needs Node crypto) and always dynamic — this checks the
// DB for due reminders on every invocation.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Cron endpoint that sends shift reminders whose lead time has arrived. Vercel
 * Cron calls this with `Authorization: Bearer <CRON_SECRET>`. When a CRON_SECRET
 * is configured, requests must present it; otherwise (preview/local without the
 * secret) it stays open so reminders still fire.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const result = await runDueReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[v0] cron reminders failed:", err)
    return NextResponse.json({ ok: false, error: "Failed to run reminders" }, { status: 500 })
  }
}
