import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { slugifyFilename, ensureUniqueFilename } from "@/lib/slugify-filename"

/**
 * POST /api/upload
 * POST /api/upload?resize=N  (resize param currently accepted for forward-compat
 *                            but not yet implemented — file is saved at full size)
 *
 * Body: multipart/form-data with a single "file" field containing an image.
 *
 * Returns: { url: "/uploads/<filename>", filename: "<filename>", size, contentType }
 *
 * The filename is auto-slugified from the original (kebab-case, preserves
 * extension) for SEO value. Collisions are handled by appending -2, -3, etc.
 * (NOT a random suffix — preserving the keyword signal for Google Images).
 *
 * Example:
 *   upload("Babar Azam Century.jpg") → saves to /public/uploads/babar-azam-century.jpg
 *   upload("Babar Azam Century.jpg") again → saves to /public/uploads/babar-azam-century-2.jpg
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60 // 1 minute — images should upload fast

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Allowed image content-types + the extension we'll save them as.
const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
}

export async function POST(req: NextRequest) {
  // Auth — site admin only (matches the upload-video route's pattern).
  // The UploadButton is only rendered inside admin views (articles/banners/
  // players/galleries), so site-admin auth is the right scope.
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json(
        { error: "no file provided" },
        { status: 400 }
      )
    }

    // Validate content-type
    const contentType = file.type || ""
    const ext = CONTENT_TYPE_TO_EXT[contentType]
    if (!ext) {
      return NextResponse.json(
        {
          error: `unsupported type: ${contentType || "unknown"} (must be jpg/png/webp/gif/svg)`,
        },
        { status: 415 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      )
    }

    // Build the SEO-friendly filename from the user's original name.
    // slugifyFilename() handles kebab-case, extension preservation, and edge cases.
    const slugified = slugifyFilename(file.name)
    // Force the extension to match the actual content-type (in case the user
    // uploaded "photo.png" but the actual bytes are JPEG — trust the bytes over the name).
    const lastDot = slugified.lastIndexOf(".")
    const base = lastDot > 0 ? slugified.slice(0, lastDot) : slugified
    let finalName = `${base}.${ext}`

    // Ensure the upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Ensure uniqueness — append -2, -3, etc. on collision (NOT random suffix).
    finalName = await ensureUniqueFilename(finalName, async (name) => {
      return existsSync(path.join(UPLOAD_DIR, name))
    })

    // Save the file
    const outPath = path.join(UPLOAD_DIR, finalName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(outPath, buffer)

    // Note: ?resize=N query param is accepted for forward-compatibility with
    // the existing UploadButton API (player avatars pass ?resize=300), but
    // actual image resizing is not yet implemented — files are saved at
    // full size. Adding sharp-based resize is a separate follow-up if needed.
    const resizeParam = new URL(req.url).searchParams.get("resize")
    if (resizeParam) {
      console.log(
        `[upload] resize=${resizeParam} requested for ${finalName} but not yet implemented — saved at full size (${file.size} bytes)`
      )
    }

    return NextResponse.json({
      url: `/uploads/${finalName}`,
      filename: finalName,
      size: file.size,
      contentType,
    })
  } catch (e) {
    return NextResponse.json(
      { error: String(e).slice(0, 200) },
      { status: 500 }
    )
  }
}
