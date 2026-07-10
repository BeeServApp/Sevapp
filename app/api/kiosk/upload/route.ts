import { put } from "@vercel/blob"
import { NextResponse } from "next/server"
import { getKioskContext } from "@/lib/kiosk-session"

// Photo upload for task-completion proof from a paired kiosk. Unlike the main
// app's upload routes, this authenticates with the kiosk device cookie (the
// iPad has no Better Auth session) and scopes files to the paired account.
export async function POST(request: Request) {
  const ctx = await getKioskContext()
  if (!ctx) {
    return NextResponse.json({ error: "This device is not paired." }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() ?? "jpg"
  const filename = `kiosk/${ctx.accountId}/${ctx.venueId}/${Date.now()}.${ext}`
  const blob = await put(filename, file, { access: "public", contentType: file.type })

  return NextResponse.json({ url: blob.url })
}
