import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

export const dynamic = "force-dynamic"

/**
 * GET /api/uploads/[name] — serves an uploaded/scraped image.
 *
 * Checks TWO locations (in order):
 *   1. db/uploads/    — the PERSISTENT volume (fly.io mounts at /app/db).
 *                       Runtime uploads + scraped images go here so they
 *                       survive machine restarts.
 *   2. public/uploads/ — build-time assets baked into the Docker image
 *                       (legacy/fallback for images that shipped with the
 *                       original repo).
 *
 * This dual-path approach ensures images persist across restarts (on the
 * volume) while still serving any pre-existing build-time images.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  // Sanitize: only the basename (no path traversal).
  const safe = path.basename(name)

  // Try the persistent volume first, then the build-time public dir.
  const volPath = path.join(process.cwd(), "db", "uploads", safe)
  const pubPath = path.join(process.cwd(), "public", "uploads", safe)
  const filePath = existsSync(volPath) ? volPath : existsSync(pubPath) ? pubPath : null

  if (!filePath) {
    return new NextResponse("Not found", { status: 404 })
  }
  try {
    const buf = await readFile(filePath)
    const ext = path.extname(safe).toLowerCase()
    const ct =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg"
    return new NextResponse(buf, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
