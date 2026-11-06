import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import sharp from "sharp"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

/**
 * POST /api/upload
 *
 * Accepts a multipart form upload (`file` field) and saves the image to the
 * persistent `db/uploads/` volume (mounted on fly.io so files survive
 * restarts). Returns `{ url: "/api/uploads/<filename>" }` — the same path
 * that GET /api/uploads/[name] serves.
 *
 * Auth: site-admin (cookie + CSRF) OR league-admin (Bearer token).
 *
 * Query params:
 *   ?resize=N  — resize the image to N×N square (cover-crop, JPEG q85).
 *                Ideal for avatars / headshots where you don't need the
 *                full-resolution original.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (requireSiteAdmin(req)) return true
  const leagueAdmin = await authenticateLeagueAdmin(req)
  return !!leagueAdmin
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 })
  }
  // 10 MB cap
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 })
  }

  // Optional resize param (e.g. ?resize=300 for a 300×300 square avatar).
  const url = new URL(req.url)
  const resizeParam = url.searchParams.get("resize")
  const resize = resizeParam ? parseInt(resizeParam, 10) : null

  // Generate a unique filename. Preserve the original extension so the
  // serving route can set the right Content-Type.
  const ext = path.extname(file.name || "").toLowerCase() || ".jpg"
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
    ? ext
    : ".jpg"
  const filename = `${randomUUID()}${resize ? ".jpg" : safeExt}`

  // Ensure the uploads directory exists on the persistent volume.
  const uploadsDir = path.join(process.cwd(), "db", "uploads")
  await mkdir(uploadsDir, { recursive: true })
  const filePath = path.join(uploadsDir, filename)

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    if (resize && resize > 0) {
      // Resize to a square (cover-crop) JPEG at quality 85 — perfect for
      // avatars / headshots.
      await sharp(buf)
        .resize(resize, resize, { fit: "cover", position: "attention" })
        .jpeg({ quality: 85 })
        .toFile(filePath)
    } else {
      await writeFile(filePath, buf)
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save file: ${String(e).slice(0, 100)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    url: `/api/uploads/${filename}`,
    filename,
  })
}
