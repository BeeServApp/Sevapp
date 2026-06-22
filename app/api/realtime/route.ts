import { getAccountId } from "@/lib/session"
import { getChannelsSince, getLatestEventId } from "@/lib/realtime"

export const dynamic = "force-dynamic"
// Keep the stream alive long enough to feel real-time in the preview.
export const maxDuration = 60

export async function GET(request: Request) {
  let accountId: string
  try {
    accountId = await getAccountId()
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()
  let closed = false
  let lastId = await getLatestEventId(accountId)

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Initial hello so the client knows the connection is live.
      send("ready", { lastId })

      const startedAt = Date.now()
      while (!closed) {
        // Poll for new change events roughly twice a second.
        await new Promise((r) => setTimeout(r, 1500))
        if (closed) break

        try {
          const rows = await getChannelsSince(accountId, lastId)
          if (rows.length > 0) {
            lastId = Math.max(...rows.map((r) => r.id))
            const channels = Array.from(new Set(rows.map((r) => r.channel)))
            send("change", { channels, lastId })
          } else {
            // Heartbeat keeps proxies from closing the idle connection.
            send("ping", { t: Date.now() })
          }
        } catch (err) {
          console.log("[v0] realtime poll error:", (err as Error).message)
        }

        // Recycle the connection before the platform timeout; client reconnects.
        if (Date.now() - startedAt > 55_000) break
      }

      if (!closed) controller.close()
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
