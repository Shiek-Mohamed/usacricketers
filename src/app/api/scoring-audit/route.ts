import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  requireSiteAdmin,
  readBearerToken,
  verifyScorerToken,
  scorerHasSeries,
  canManageSeries,
} from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Auth context for the scoring-audit endpoints. Mirrors the multi-mode
 * pattern used in `src/app/api/matches/[id]/toss/route.ts` but carries the
 * caller's identity so POST can derive `scorerId` from the verified token
 * (instead of trusting the forgeable request body).
 *
 *   • siteAdmin   — cookie + CSRF (requireSiteAdmin). scorerId comes from
 *                   the body (admins act on behalf of a scorer).
 *   • scorer      — Bearer token (verifyScorerToken). scorerId is the
 *                   token's payload.scorerId — the body's scorerId is
 *                   IGNORED.
 *   • leagueAdmin — Bearer token (authenticateLeagueAdmin). scorerId is
 *                   synthesized as `league-admin:<adminId>` so the audit
 *                   trail records who actually pushed the change.
 */
type AuthContext =
  | { mode: "siteAdmin" }
  | { mode: "scorer"; scorerId: string }
  | { mode: "leagueAdmin"; scorerId: string; managedSeriesIds: string[] }

async function resolveAuth(req: NextRequest): Promise<AuthContext | null> {
  // Mode 1 — site admin (cookie + CSRF).
  if (requireSiteAdmin(req)) return { mode: "siteAdmin" }

  const token = readBearerToken(req.headers.get("authorization"))

  // Mode 2 — scorer Bearer.
  const scorerPayload = verifyScorerToken(token)
  if (scorerPayload) {
    return { mode: "scorer", scorerId: scorerPayload.scorerId }
  }

  // Mode 3 — league-admin Bearer.
  const laRes = await authenticateLeagueAdmin(req)
  if ("ctx" in laRes) {
    return {
      mode: "leagueAdmin",
      scorerId: `league-admin:${laRes.ctx.payload.adminId}`,
      managedSeriesIds: laRes.ctx.managedSeriesIds,
    }
  }
  return null
}

/**
 * Gate a caller's access to a match's audit data by series membership.
 *   • siteAdmin   → always allowed
 *   • scorer      → must have a ScorerAssignment for the match's series
 *   • leagueAdmin → must manage the match's series (god-mode covers all)
 */
async function canAccessMatch(
  auth: AuthContext,
  matchSeriesId: string | null,
): Promise<boolean> {
  if (auth.mode === "siteAdmin") return true
  if (auth.mode === "scorer") {
    return scorerHasSeries(auth.scorerId, matchSeriesId)
  }
  return canManageSeries(auth.managedSeriesIds, matchSeriesId)
}

/** POST /api/scoring-audit — logs a scoring action to the audit trail.
 *  Body: { matchId, scorerId?, action, ballNo?, detail? }
 *
 *  Auth: site-admin cookie, scorer Bearer, or league-admin Bearer. The
 *  `scorerId` is derived from the verified token for scorer/league-admin
 *  modes (NEVER from the request body — the body value is forgeable and
 *  would let anyone pollute the audit trail with arbitrary scorer ids).
 *  Site-admins may pass `scorerId` in the body because they act on behalf
 *  of a scorer and don't hold a scorer token themselves.
 *
 *  Rate-limited to 200 POSTs / minute / IP (a legit scorer posts a handful
 *  of audit rows per ball — well under the cap; a flood is throttled at
 *  the network layer before any DB work).
 *
 *  Non-fatal — errors are logged but don't block scoring. */
export async function POST(req: NextRequest) {
  // Rate limit BEFORE auth so a flood of unauthenticated POSTs is throttled
  // without consuming DB connections.
  const limited = rateLimit(req, { limit: 200, windowMs: 60_000 })
  if (limited) return limited

  try {
    const auth = await resolveAuth(req)
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    const matchId = String(body.matchId || "")
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 })
    }

    // Look up the match's seriesId so we can gate by series membership.
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { seriesId: true },
    })
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }
    if (!(await canAccessMatch(auth, match.seriesId))) {
      return NextResponse.json(
        { error: "Forbidden: this match is not in your tournaments" },
        { status: 403 },
      )
    }

    // Derive scorerId from the verified identity. Site-admins may act on
    // behalf of a scorer (scorerId from the body); scorer/league-admin
    // tokens always use their own identity — the body's scorerId is ignored.
    const scorerId: string | null =
      auth.mode === "siteAdmin" ? body.scorerId || null : auth.scorerId

    await db.scoringAudit.create({
      data: {
        matchId,
        scorerId,
        action: String(body.action || "unknown"),
        ballNo: Number(body.ballNo) || 0,
        detail: String(body.detail || ""),
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Non-fatal — scoring must continue even if audit logging fails
    console.error("[scoring-audit] Failed to log:", e)
    return NextResponse.json({ ok: false, error: String(e).slice(0, 100) }, { status: 500 })
  }
}

/** GET /api/scoring-audit?matchId=X — retrieves the audit trail for a match.
 *
 *  Auth required (any of the three modes). Scorers/league-admins only see
 *  rows for matches in their assigned series; site-admins see all rows
 *  (capped at 500, most recent first) when no matchId is provided. */
export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req)
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get("matchId")

  try {
    // No matchId: only site-admins can dump the unfiltered trail (capped at
    // 500 rows). Scorers/league-admins get an empty list — they must scope
    // by matchId so the series gate can be applied per-row.
    if (!matchId) {
      if (auth.mode === "siteAdmin") {
        const logs = await db.scoringAudit.findMany({
          orderBy: { timestamp: "desc" },
          take: 500,
        })
        return NextResponse.json(logs)
      }
      return NextResponse.json([])
    }

    // matchId provided — gate by series membership before returning rows.
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { seriesId: true },
    })
    if (!match) {
      return NextResponse.json([])
    }
    if (!(await canAccessMatch(auth, match.seriesId))) {
      return NextResponse.json(
        { error: "Forbidden: this match is not in your tournaments" },
        { status: 403 },
      )
    }

    const logs = await db.scoringAudit.findMany({
      where: { matchId },
      orderBy: { timestamp: "asc" },
      take: 500,
    })
    return NextResponse.json(logs)
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
