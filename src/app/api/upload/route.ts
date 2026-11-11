import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // 1 min — images are smaller than videos

// Uploads go to db/uploads/ — the persistent volume (fly.io mounts at /app/db).
// This ensures uploaded images survive machine restarts and deploys.
// The /api/uploads/[name] route checks db/uploads/ first, then public/uploads/.
const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads")
const MAX_IMAGE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

function randomName(ext: string): string {
  return (
    Buffer.from(Math.random().toString(36).slice(2) + Date.now().toString(36))
      .toString("hex")
      .slice(0, 16) +
    "." +
    ext
  )
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png"
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    default:
      return "jpg"
  }
}

export async function POST(req: NextRequest) {
  // Auth — site admins via CSRF cookie
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const form = await req.formData()
    const file = form.get("file")

    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_IMAGE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_IMAGE / 1024 / 1024}MB)` },
        { status: 413 },
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 415 },
      )
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    const ext = getExtension(file.type)
    const filename = randomName(ext)
    const filepath = path.join(UPLOAD_DIR, filename)

    // Check for optional resize query param (e.g., ?resize=300 for square crop)
    const resizeParam = req.nextUrl.searchParams.get("resize")
    const resizeSize = resizeParam ? parseInt(resizeParam, 10) : 0

    if (resizeSize > 0) {
      // Resize using sharp — square cover crop, JPEG q85
      const sharp = (await import("sharp")).default
      const buffer = Buffer.from(await file.arrayBuffer())
      await sharp(buffer)
        .resize(resizeSize, resizeSize, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 85 })
        .toFile(filepath.replace(/\.\w+$/, ".jpg"))
      // Update filename to .jpg if it was resized
      const resizedFilename = filename.replace(/\.\w+$/, ".jpg")
      // Return /api/uploads/ path — the serving route checks the persistent
      // volume (db/uploads/) first, then public/uploads/ as fallback.
      return NextResponse.json({
        url: `/api/uploads/${resizedFilename}`,
        filename: resizedFilename,
      })
    } else {
      // Save original file as-is
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filepath, buffer)
      // Return /api/uploads/ path — served from the persistent volume.
      return NextResponse.json({
        url: `/api/uploads/${filename}`,
        filename,
      })
    }
  } catch (e: any) {
    console.error("[upload] Error:", e)
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 500 },
    )
  }
}
