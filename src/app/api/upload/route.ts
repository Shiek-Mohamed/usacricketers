import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import sharp from "sharp"

export const dynamic = "force-dynamic"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const MAX_IMAGE = 5 * 1024 * 1024 // 5 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]

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
    const resizeParam = new URL(req.url).searchParams.get("resize")
    const resize = resizeParam ? Math.min(2000, Math.max(32, Number(resizeParam))) : undefined
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "no file provided" }, { status: 400 })
    }
    if (file.size > MAX_IMAGE) {
      return NextResponse.json({ error: "file too large (max 5MB)" }, { status: 413 })
    }
    const ct = file.type || ""
    if (!ALLOWED.includes(ct)) {
      return NextResponse.json({ error: `unsupported type: ${ct}` }, { status: 415 })
    }

    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())

    let outPath: string
    let outUrl: string
    if (resize) {
      // cover-crop to a square JPEG q85
      const name = randomName("jpg")
      outPath = path.join(UPLOAD_DIR, name)
      outUrl = `/uploads/${name}`
      await sharp(buf)
        .resize(resize, resize, { fit: "cover", position: "centre" })
        .jpeg({ quality: 85 })
        .toFile(outPath)
    } else {
      const ext =
        ct.includes("png") ? "png"
        : ct.includes("webp") ? "webp"
        : ct.includes("gif") ? "gif"
        : ct.includes("svg") ? "svg"
        : "jpg"
      const name = randomName(ext)
      outPath = path.join(UPLOAD_DIR, name)
      outUrl = `/uploads/${name}`
      await writeFile(outPath, buf)
    }
    return NextResponse.json({ url: outUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
