import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { requireSiteAdmin } from "@/lib/scorer-auth"

/**
 * POST /api/upload — site-admin only. Accepts a single image file (PNG / JPEG
 * / WebP / GIF) and writes it to /public/uploads. Returns `{ url }` on
 * success.
 *
 * Used by `<UploadButton>` (the admin image-upload component) — banner image
 * uploads, player avatars, gallery photos, etc. Without this route the
 * UploadButton POSTs to a non-existent URL and Next.js returns a 404 HTML
 * page; the client's `await res.json()` then throws a SyntaxError because
 * the body isn't JSON.
 *
 * Query params:
 *   • resize=N — optional. Resizes the image to NxN square (cover-cropped,
 *     JPEG q85). Uses Sharp if installed; otherwise falls back to writing
 *     the original.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 300 // allow large uploads up to 5 min

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const MAX_IMAGE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_PREFIXES = ["image/"]

function randomName(ext: string): string {
  return (
    Buffer.from(Math.random().toString(36).slice(2) + Date.now().toString(36))
      .toString("hex")
      .slice(0, 16) +
    "." +
    ext
  )
}

async function maybeResize(
  buf: Buffer,
  mime: string,
  size: number
): Promise<Buffer> {
  if (!size) return buf
  // Dynamic import — Sharp is optional (skipped if not installed).
  try {
    const sharp = (await import("sharp")).default
    return await sharp(buf)
      .resize(size, size, { fit: "cover", position: "centre" })
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch {
    // Sharp not installed or resize failed — write the original.
    return buf
  }
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const resize = Number(searchParams.get("resize")) || 0

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }
    if (file.size > MAX_IMAGE) {
      return NextResponse.json(
        { error: `File too large — max ${MAX_IMAGE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }
    const mime = file.type || ""
    if (!ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) {
      return NextResponse.json(
        { error: "Only image files (PNG, JPEG, WebP, GIF) are accepted" },
        { status: 415 }
      )
    }

    let buf = Buffer.from(await file.arrayBuffer())
    const ext =
      mime.includes("png")
        ? "png"
        : mime.includes("webp")
          ? "webp"
          : mime.includes("gif")
            ? "gif"
            : "jpg"

    if (resize > 0) {
      // Resize returns JPEG bytes — ext becomes jpg.
      buf = await maybeResize(buf, mime, resize)
      const resizedName = randomName("jpg")
      if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
      await writeFile(path.join(UPLOAD_DIR, resizedName), buf)
      return NextResponse.json({ url: `/uploads/${resizedName}` })
    }

    const name = randomName(ext)
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(UPLOAD_DIR, name), buf)
    return NextResponse.json({ url: `/uploads/${name}` })
  } catch (e) {
    return NextResponse.json(
      { error: `Upload failed: ${String(e).slice(0, 200)}` },
      { status: 500 }
    )
  }
}
