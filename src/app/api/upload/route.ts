import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { rateLimit } from "@/lib/rate-limit"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// image content-type -> extension
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
}

export async function POST(req: NextRequest) {
  // Light abuse protection (admin-only in practice).
  const limited = rateLimit(req, { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  let file: File | null = null
  try {
    const formData = await req.formData()
    file = formData.get("file") as File | null
  } catch {
    return NextResponse.json(
      { error: "Invalid upload (expected multipart/form-data)." },
      { status: 400 }
    )
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 })
  }

  const ext = EXT_BY_TYPE[file.type]
  if (!ext) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.type || "unknown"}. Use PNG, JPEG, WebP, GIF or SVG.`,
      },
      { status: 415 }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.` },
      { status: 413 }
    )
  }

  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }
    // Unique, URL-safe filename. Prefix with a timestamp + random so repeated
    // uploads of the same image don't collide.
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filepath = path.join(UPLOAD_DIR, name)
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))
    return NextResponse.json({
      url: `/uploads/${name}`,
      name,
      size: file.size,
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save file: ${String(e)}` },
      { status: 500 }
    )
  }
}
