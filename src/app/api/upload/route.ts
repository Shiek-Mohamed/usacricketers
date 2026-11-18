import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import sharp from "sharp"
import {
  requireSiteAdmin,
  readBearerToken,
  verifyLeagueAdminToken,
} from "@/lib/scorer-auth"
import { slugifyFilename, ensureUniqueFilename } from "@/lib/slugify-filename"

export const dynamic = "force-dynamic"

/**
 * POST /api/upload — accepts a multipart/form-data `file` field (an image)
 * and persists it to the PERSISTENT volume `db/uploads/` (fly.io mounts
 * /app/db, so uploads survive machine restarts). Files are served back
 * publicly via the existing GET /api/uploads/[name] route.
 *
 * Auth (dual — either tier passes):
 *   1. site-admin  — `sa-session` cookie + CSRF double-submit header
 *                    (POST requires the `X-CSRF-Token` header to match the
 *                    `csrf-token` cookie). See `requireSiteAdmin`.
 *   2. league-admin — `Authorization: Bearer <token>` header, HMAC-signed
 *                     via `verifyLeagueAdminToken`.
 *   If neither passes -> 401 { error: "unauthorized" }.
 *
 * Optional query param `?resize=N` (N clamped to 16-1024):
 *   when present, the image is resized with `sharp` to an N x N cover-crop
 *   and re-encoded as JPEG (quality 85); the saved extension is forced to
 *   `.jpg` regardless of the input format. Intended for avatars/headshots.
 *
 *   when ABSENT, the ORIGINAL bytes are written verbatim (no re-encode) so
 *   quality, format and animation (e.g. animated GIFs) are fully preserved;
 *   the extension is derived from the MIME type.
 *
 * Filenames are slugified (SEO-friendly kebab-case, preserving the keyword
 * signal) and de-duplicated by appending -2, -3, ... on collision (NOT a
 * random suffix - preserves SEO value).
 *
 * Returns:
 *   200 { url: "/api/uploads/<filename>" }
 *   400 { error: "no file" } | { error: "only images allowed" }
 *   401 { error: "unauthorized" }
 *   500 { error: "upload failed" }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Dual auth: site-admin cookie/session first, then league-admin bearer.
    let authorized = !!requireSiteAdmin(req)
    if (!authorized) {
      // readBearerToken returns string | null; verifyLeagueAdminToken expects
      // a string and would throw on null (no Authorization header) — guard it
      // so the no-auth path returns a clean 401 instead of a 500.
      const token = readBearerToken(req.headers.get("authorization"))
      authorized = token ? !!verifyLeagueAdminToken(token) : false
    }
    if (!authorized) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    // 2. Parse multipart/form-data and pull the `file` field.
    const form = await req.formData()
    const entry = form.get("file")
    if (!entry || typeof entry === "string" || !(entry instanceof File)) {
      return NextResponse.json({ error: "no file" }, { status: 400 })
    }
    const file = entry

    // 3. Reject non-images (defends against arbitrary binary uploads).
    const contentType = file.type || ""
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "only images allowed" },
        { status: 400 }
      )
    }

    // 4. Optional ?resize=N - clamp to 16-1024, parse strictly as positive int.
    const resizeRaw = req.nextUrl.searchParams.get("resize")
    let resize: number | null = null
    if (resizeRaw !== null) {
      const n = Number.parseInt(resizeRaw, 10)
      if (Number.isFinite(n) && n > 0) {
        resize = Math.min(1024, Math.max(16, n))
      }
    }

    // 5. Storage dir - mkdir -p (idempotent; safe even if it already exists).
    const uploadDir = path.join(process.cwd(), "db", "uploads")
    await mkdir(uploadDir, { recursive: true })

    // 6. Build the buffer + target extension.
    //    - resize path: sharp cover-crop NxN -> JPEG q85, forced `.jpg` ext.
    //    - preserve path: original bytes verbatim, ext derived from MIME
    //      (so a PNG mislabeled "x.jpg" is still saved as "x.png").
    const originalName = file.name || "upload"
    let buffer: Buffer
    let targetExt: string

    if (resize) {
      const raw = Buffer.from(await file.arrayBuffer())
      buffer = await sharp(raw)
        .resize(resize, resize, { fit: "cover", position: "centre" })
        .jpeg({ quality: 85 })
        .toBuffer()
      targetExt = ".jpg"
    } else {
      buffer = Buffer.from(await file.arrayBuffer())
      targetExt = mimeToImageExt(contentType)
    }

    // 7. Slugify + de-duplicate. Strip the original ext first, then append
    //    the target ext so the saved filename always reflects actual content.
    const baseName = stripExt(originalName)
    const workingName = `${baseName}${targetExt}`
    const slug = slugifyFilename(workingName)
    const finalFilename = await ensureUniqueFilename(
      slug,
      async (n) => existsSync(path.join(uploadDir, n))
    )

    // 8. Persist to the volume.
    await writeFile(path.join(uploadDir, finalFilename), buffer)

    // 9. Return the public serve URL.
    return NextResponse.json(
      { url: `/api/uploads/${finalFilename}` },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ error: "upload failed" }, { status: 500 })
  }
}

/**
 * Map an image MIME type to its canonical lowercase file extension.
 * Used only on the preserve-format path (resize path always uses .jpg).
 */
function mimeToImageExt(mime: string): string {
  if (mime === "image/png") return ".png"
  if (mime === "image/webp") return ".webp"
  if (mime === "image/gif") return ".gif"
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg"
  // Unknown image/* - default to .jpg (the serve route also falls back to
  // image/jpeg for unknown extensions, so this stays consistent).
  return ".jpg"
}

/**
 * Strip the final extension from a filename. Leaves leading-dot filenames
 * (e.g. ".hidden") untouched so they slugify to "hidden".
 */
function stripExt(name: string): string {
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return name
  return name.slice(0, dot)
}
