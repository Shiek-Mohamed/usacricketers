import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import sharp from "sharp"
import { rateLimit } from "@/lib/rate-limit"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  // Optional resize: ?resize=300  → 300x300 square (good for headshots/avatars)
  const url = new URL(req.url)
  const resizeParam = url.searchParams.get("resize")

  let file: File | null = null
  try {
    const formData = await req.formData()
    file = formData.get("file") as File | null
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 })
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 })
  }

  const ext = EXT_BY_TYPE[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type || "unknown"}. Use PNG, JPEG, WebP, GIF or SVG.` },
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
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const filepath = path.join(UPLOAD_DIR, name)
    const buf = Buffer.from(await file.arrayBuffer())

    if (resizeParam) {
      // Resize to a square, convert to JPEG quality 85 (small file for avatars)
      const size = Math.min(800, Math.max(50, parseInt(resizeParam, 10) || 300))
      await sharp(buf)
        .resize(size, size, { fit: "cover", position: "center" })
        .jpeg({ quality: 85 })
        .toFile(filepath + ".jpg")
      return NextResponse.json({ url: `/uploads/${name}.jpg`, name: `${name}.jpg`, size })
    }

    await writeFile(filepath + "." + ext, buf)
    return NextResponse.json({ url: `/uploads/${name}.${ext}`, name: `${name}.${ext}`, size: file.size })
  } catch (e) {
    return NextResponse.json({ error: `Failed to save: ${String(e)}` }, { status: 500 })
  }
}
