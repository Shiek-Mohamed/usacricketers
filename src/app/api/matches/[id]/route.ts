import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"
import {
  requireSiteAdmin,
  readBearerToken,
  verifyScorerToken,
  scorerHasSeries,
} from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

/**
 * Multi-mode authorization for match mutations — mirrors the pattern used in
 * `src/app/api/matches/[id]/toss/route.ts`. Accepts any one of:
 *
 *   1. Site-admin cookie (`sa-session`) + CSRF double-submit (X-CSRF-Token
 *      header matches csrf-token cookie). This is the path used by the CMS
 *      admin UI — `requireSiteAdmin` performs both checks.
 *   2. Scorer Bearer token (Authorization: Bearer <signed-token>) verified
 *      with `verifyScorerToken` AND gated by `scorerHasSeries` for the
 *      match's series. Scorers log in via /api/scorer/login and hold only a
 *      Bearer token (no cookie), so they previously 401'd on PUT /matches/[id]
 *      — that broke persist() from scorer-mode and liveStateJson was never
 *      written. Bearer headers aren't auto-attached by browsers, so this
 *      path is immune to CSRF.
 *   3. League-admin Bearer token verified with `authenticateLeagueAdmin`.
 *
 * Returns true if any mode succeeds, false otherwise. The caller is
 * responsible for returning 401 when this returns false.
 */
async function isAuthorized(
  req: NextRequest,
  matchSeriesId: string | null,
): Promise<boolean> {
  // Mode 1 — site admin (cookie + CSRF).
  if (requireSiteAdmin(req)) return true

  const token = readBearerToken(req.headers.get("authorization"))

  // Mode 2 — scorer Bearer.
  const scorerPayload = verifyScorerToken(token)
  if (scorerPayload) {
    return await scorerHasSeries(scorerPayload.scorerId, matchSeriesId)
  }

  // Mode 3 — league-admin Bearer.
  const leagueAdminRes = await authenticateLeagueAdmin(req)
  return "ctx" in leagueAdminRes
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const match = await db.match.findUnique({
    where: { id },
    include: { team1: true, team2: true, series: true },
  })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeMatch(match))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Fetch the match's seriesId first so scorerHasSeries can gate the Bearer
  // path. Site-admins and league-admins bypass the series check.
  const match = await db.match.findUnique({
    where: { id },
    select: { id: true, seriesId: true },
  })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await isAuthorized(req, match.seriesId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const updated = await db.match.update({
    where: { id },
    data: {
      seriesId: body.seriesId || null,
      team1Id: body.team1Id,
      team2Id: body.team2Id,
      format: body.format,
      matchNo: body.matchNo,
      status: body.status,
      venue: body.venue,
      city: body.city,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      result: body.result,
      manOfMatch: body.manOfMatch === undefined ? undefined : (body.manOfMatch || null),
      umpires: body.umpires === undefined ? undefined : body.umpires,
      tvUmpire: body.tvUmpire === undefined ? undefined : body.tvUmpire,
      referee: body.referee === undefined ? undefined : body.referee,
      tossWinnerId: body.tossWinnerId === undefined ? undefined : (body.tossWinnerId || null),
      tossDecision: body.tossDecision === undefined ? undefined : (body.tossDecision || null),
      scorecard:
        typeof body.scorecard === "string"
          ? body.scorecard
          : body.scorecard
          ? JSON.stringify(body.scorecard)
          : "",
      liveStateJson: body.liveStateJson === undefined ? undefined : String(body.liveStateJson),
    },
    include: { team1: true, team2: true, series: true },
  })
  return NextResponse.json(serializeMatch(updated))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    await db.match.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
