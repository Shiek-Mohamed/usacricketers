import { NextRequest, NextResponse } from "next/server"
import { readdir, stat } from "fs/promises"
import type { Dirent, Stats } from "fs"
import path from "path"
import { rateLimit } from "@/lib/rate-limit"
import {
  requireSiteAdmin,
  readBearerToken,
  verifyLeagueAdminToken,
} from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/uploads — lists every uploaded image for the admin media browser.
 *
 * Reads BOTH upload directories and merges them:
 *   1. db/uploads/    - the PERSISTENT volume (runtime uploads + scraped
 *                       images live here so they survive restarts).
 *   2. public/uploads/ - build-time assets baked into the Docker image
 *                       (legacy/fallback images that shipped with the repo).
 *
 * This mirrors the dual-path resolution used by GET /api/uploads/[name]
 * (the serve route), so the media browser shows exactly what can be served.
 *
 * Auth (dual - either tier passes):
 *   1. site-admin  - `sa-session` cookie. NOTE: for GET, `requireSiteAdmin`
 *                    does NOT enforce the CSRF header (CSRF only applies to
 *                    POST/PUT/DELETE/PATCH), so a valid cookie alone is
 *                    sufficient.
 *   2. league-admin - `Authorization: Bearer <token>` header.
 *   If neither passes -> 401 { error: "unauthorized" }.
 *
 * Behaviour:
 *   - Only image extensions are returned (.png/.jpg/.jpeg/.webp/.gif/.svg).
 *   - Dedup by name: if a file exists in BOTH db and public, the `db` copy
 *     wins (matches the serve route's priority order).
 *   - Sorted by mtime DESC (newest first).
 *
 * Response (200):
 *   { items: { name: string; url: string; size: number;
 *              mtime: number; source: "db" | "public" }[] }
 *
 * Cache-Control: no-store (admin-only listing, must not be edge-cached).
 */
export async function GET(req: NextRequest) {
  try {
    // 0. Light rate limit - mirrors /api/galleries.
    const limited = rateLimit(req, { limit: 120, windowMs: 60_000 })
    if (limited) return limited

    // 1. Dual auth: site-admin (cookie-only for GET) OR league-admin bearer.
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

    const dbDir = path.join(process.cwd(), "db", "uploads")
    const pubDir = path.join(process.cwd(), "public", "uploads")

    // 2. Read both dirs (treat missing dir as empty). db wins on dedup so
    //    collect db entries first, then public entries that aren't shadowed.
    const byName = new Map<string, MediaItem>()

    await collectDir(byName, dbDir, "db")
    await collectDir(byName, pubDir, "public")

    // 6. Sort by mtime DESC (newest first).
    const items = Array.from(byName.values()).sort(
      (a, b) => b.mtime - a.mtime
    )

    // 9. Admin-only listing - never edge-cache.
    const res = NextResponse.json({ items }, { status: 200 })
    res.headers.set("Cache-Control", "no-store")
    return res
  } catch {
    return NextResponse.json(
      { error: "listing failed" },
      { status: 500 }
    )
  }
}

interface MediaItem {
  name: string
  url: string
  size: number
  mtime: number
  source: "db" | "public"
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"])

/**
 * Scan one directory and merge its image files into the result map.
 * Files already present in the map (from a higher-priority source) are
 * NOT overwritten, so callers should collect the higher-priority dir first.
 * Missing directories (ENOENT) are silently treated as empty.
 */
async function collectDir(
  out: Map<string, MediaItem>,
  dir: string,
  source: "db" | "public"
): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    // ENOENT (dir doesn't exist) or any other read error -> treat as empty.
    // The other dir still gets returned; we never crash the whole listing.
    void err
    return
  }

  for (const entry of entries) {
    // Skip subdirectories - only flat files (matches the serve route, which
    // only reads basenames from these dirs).
    if (!entry.isFile() && !entry.isSymbolicLink()) continue

    const name = entry.name
    const ext = path.extname(name).toLowerCase()
    if (!IMAGE_EXTS.has(ext)) continue

    // Dedup: higher-priority source (already in map) wins.
    if (out.has(name)) continue

    let st: Stats
    try {
      st = await stat(path.join(dir, name))
    } catch {
      continue // file vanished between readdir + stat - skip it.
    }

    out.set(name, {
      name,
      url: `/api/uploads/${name}`,
      size: st.size,
      mtime: st.mtimeMs,
      source,
    })
  }
}
