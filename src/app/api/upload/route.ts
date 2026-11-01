import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Upload directory — uses the PERSISTENT volume (/app/db on fly.io) so
 * uploaded images survive machine restarts. process.cwd() is /app in the
 * container, so this resolves to /app/db/uploads (on the volume). In local
 * dev it's <project>/db/uploads.
 */
const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads")
const MAX_IMAGE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_PREFIXES = ["image/"]

function randomName(ext: string): string {
  return (
    Buffer.from(
      Math.random().toString(36).slice(2) + Date.now().toString(36)
    )
      .toString("hex")
      .slice(0, 16) +
    "." +
    ext
  )
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "no file provided" }, { status: 400 })
    }
    if (file.size > MAX_IMAGE) {
      return NextResponse.json(
        { error: "file too large (max 20MB)" },
        { status: 413 }
      )
    }
    const ct = file.type || ""
    if (!ALLOWED_PREFIXES.some((p) => ct.startsWith(p))) {
      return NextResponse.json(
        { error: `unsupported type: ${ct || "unknown"} (must be image/*)` },
        { status: 415 }
      )
    }

    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })

    const url = new URL(req.url)
    const resize = url.searchParams.get("resize")
    const resizeN = resize ? parseInt(resize, 10) : NaN

    const buf = Buffer.from(await file.arrayBuffer())

    if (Number.isFinite(resizeN) && resizeN > 0 && resizeN <= 2000) {
      try {
        const sharp = (await import("sharp")).default
        const outName = randomName("jpg")
        const outPath = path.join(UPLOAD_DIR, outName)
        await sharp(buf)
          .resize(resizeN, resizeN, { fit: "cover", position: "centre" })
          .jpeg({ quality: 85 })
          .toFile(outPath)
        return NextResponse.json({
          url: `/api/uploads/${outName}`,
          size: file.size,
          resized: `${resizeN}x${resizeN}`,
        })
      } catch {
        // sharp failed — fall through to saving the original
      }
    }

    let ext = "jpg"
    if (ct.includes("png")) ext = "png"
    else if (ct.includes("webp")) ext = "webp"
    else if (ct.includes("gif")) ext = "gif"
    else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg"

    const outName = randomName(ext)
    const outPath = path.join(UPLOAD_DIR, outName)
    await writeFile(outPath, buf)

    return NextResponse.json({
      url: `/api/uploads/${outName}`,
      size: file.size,
      contentType: ct,
    })
  } catch (e) {
    return NextResponse.json(
      { error: String(e).slice(0, 200) },
      { status: 500 }
    )
  }
}
