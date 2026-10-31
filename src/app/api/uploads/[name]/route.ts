import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

export const dynamic = "force-dynamic"

/**
 * GET /api/uploads/[name] — serves an uploaded image from the uploads
 * directory. This exists because Next.js standalone doesn't reliably serve
 * files added to public/ at RUNTIME (only build-time public assets are
 * served via the static middleware). Routing uploads through this API
 * handler guarantees the file is found regardless of process.cwd() or
 * static-file manifest issues.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  // Sanitize: only the basename (no path traversal).
  const safe = path.basename(name)
  const filePath = path.join(process.cwd(), "public", "uploads", safe)
  if (!existsSync(filePath)) {
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
