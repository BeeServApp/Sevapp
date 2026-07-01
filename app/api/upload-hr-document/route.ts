import { put } from "@vercel/blob"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, Word or image files are allowed" },
      { status: 400 },
    )
  }

  // Limit to 15 MB
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() ?? "bin"
  const filename = `hr-documents/${session.user.id}/${Date.now()}.${ext}`

  // HR documents contain sensitive personal data — store privately, not public.
  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: true,
  })

  return NextResponse.json({ url: blob.url, name: file.name })
}
