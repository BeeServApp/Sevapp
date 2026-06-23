import { NextResponse } from "next/server"
import { runDueScheduledPublishes } from "@/app/actions/scheduled-publish"

// Always run dynamically — this checks the DB for due jobs on every invocation.
export const dynamic = "force-dynamic"

/**
 * Cron endpoint that auto-publishes any rota whose scheduled time has arrived.
 * Vercel Cron calls this with `Authorization: Bearer <CRON_SECRET>`. When a
 * CRON_SECRET is configured, requests must present it; otherwise (preview/local
 * without the secret) it stays open so the schedule still works.
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
    const result = await runDueScheduledPublishes()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[v0] cron publish-rotas failed:", err)
    return NextResponse.json({ ok: false, error: "Failed to run scheduled publishes" }, { status: 500 })
  }
}
