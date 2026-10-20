import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // allow large uploads up to 5 min

const VIDEO_DIR = path.join(process.cwd(), "public", "uploads", "videos")
const MAX_VIDEO = 500 * 1024 * 1024 // 500 MB
const ALLOWED_PREFIXES = ["video/"]

function randomName(ext: string): string {
  return (
    Buffer.from(Math.random().toString(36).slice(2) + Date.now().toString(36))
      .toString("hex")
      .slice(0, 16) +
    "." +
    ext
  )
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "no file provided" }, { status: 400 })
    }
    if (file.size > MAX_VIDEO) {
      return NextResponse.json(
        { error: "file too large (max 500MB)" },
        { status: 413 }
      )
    }
    const ct = file.type || ""
    if (!ALLOWED_PREFIXES.some((p) => ct.startsWith(p))) {
      return NextResponse.json(
        { error: `unsupported type: ${ct || "unknown"} (must be a video/*)` },
        { status: 415 }
      )
    }

    if (!existsSync(VIDEO_DIR)) await mkdir(VIDEO_DIR, { recursive: true })

    // Pick a sensible extension from the mime type (video/mp4 → mp4, video/webm → webm, etc.).
    let ext = "mp4"
    if (ct.includes("webm")) ext = "webm"
    else if (ct.includes("quicktime") || ct.includes("mov")) ext = "mov"
    else if (ct.includes("avi")) ext = "avi"
    else if (ct.includes("mpeg")) ext = "mpeg"
    else if (ct.includes("mp4")) ext = "mp4"

    const name = randomName(ext)
    const outPath = path.join(VIDEO_DIR, name)
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(outPath, buf)

    return NextResponse.json({
      url: `/uploads/videos/${name}`,
      size: file.size,
      contentType: ct,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
