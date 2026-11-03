import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { randomUUID } from "node:crypto"
import { requireSiteAdmin, verifyScorerToken, readBearerToken } from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/voice-clip — upload a short voice commentary clip.
 *
 * Body: multipart/form-data with an "audio" field (audio/webm, audio/ogg,
 * audio/mp4, audio/mpeg, etc.).
 * Query: ?matchId=xxx
 *
 * Auth: accepts EITHER a site-admin session cookie (sa-session + CSRF
 * double-submit), a league-admin bearer token, OR a scorer bearer token.
 * The live-scorer view typically has a scorer bearer token (either a real
 * scorer session or the god-mode token minted by /api/admin/scorer-token
 * for site admins), so supporting all three means the upload just works
 * regardless of which path the scorer used to authenticate.
 *
 * Returns: { url: "/api/uploads/voice-<uuid>.<ext>", id: "<uuid>" }
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const matchId = url.searchParams.get("matchId")
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 })
  }

  // Try site admin (cookie + CSRF) first.
  const admin = requireSiteAdmin(req)
  if (!admin) {
    // Try league admin bearer token.
    const leagueAuth = await authenticateLeagueAdmin(req)
    if ("response" in leagueAuth) {
      // Try scorer bearer token.
      const bearer = readBearerToken(req.headers.get("authorization"))
      if (!bearer) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 })
      }
      const scorer = verifyScorerToken(bearer)
      if (!scorer) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 })
      }
    }
  }

  try {
    const form = await req.formData()
    const file = form.get("audio")
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "no audio provided" }, { status: 400 })
    }
    // 5MB cap — commentary clips are short (~30s of speech), not full uploads.
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "clip too large (max 5MB)" }, { status: 413 })
    }

    // Only accept audio/* types — defends against someone trying to upload
    // arbitrary binaries through this route.
    const ct = file.type || ""
    if (!ct.startsWith("audio/")) {
      return NextResponse.json(
        { error: `unsupported type: ${ct || "unknown"} (must be audio/*)` },
        { status: 415 }
      )
    }

    const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads")
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })

    const id = randomUUID()
    // Map common mime types to extensions. Chrome/Firefox emit audio/webm;
    // Safari emits audio/mp4; some browsers emit audio/ogg. Default to webm.
    const ext = ct.includes("webm")
      ? "webm"
      : ct.includes("ogg")
        ? "ogg"
        : ct.includes("mp4") || ct.includes("mpeg")
          ? "mp4"
          : "webm"
    const filename = `voice-${id}.${ext}`
    const outPath = path.join(UPLOAD_DIR, filename)
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(outPath, buf)

    return NextResponse.json({
      url: `/api/uploads/${filename}`,
      id,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
