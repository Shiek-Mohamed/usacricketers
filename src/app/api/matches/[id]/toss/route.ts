import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"
import {
  verifyScorerToken,
  readBearerToken,
  scorerHasSeries,
  requireSiteAdmin,
} from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

/**
 * PUT /api/matches/[id]/toss
 *
 * Sets the toss winner + decision on a match. Auth: site-admin (cookie),
 * league-admin (Bearer), or scorer (Bearer) — as long as the scorer has an
 * assignment to the match's series. This lets the scorer record the toss at
 * match setup time without needing CMS admin access.
 *
 * Body: { tossWinnerId: string, tossDecision: "bat" | "bowl" }
 * Either field can be null to clear the toss.
 */
async function isAuthorized(req: NextRequest, matchSeriesId: string | null) {
  // Site admin (cookie + CSRF)
  if (requireSiteAdmin(req)) return true
  const token = readBearerToken(req.headers.get("authorization"))
  const payload = verifyScorerToken(token)
  if (payload) {
    // Scorer must have an assignment to the match's series
    return await scorerHasSeries(payload.scorerId, matchSeriesId)
  }
  // League admin
  const leagueAdmin = await authenticateLeagueAdmin(req)
  return !!leagueAdmin
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const match = await db.match.findUnique({
    where: { id },
    select: { id: true, team1Id: true, team2Id: true, seriesId: true },
  })
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })

  if (!(await isAuthorized(req, match.seriesId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const tossWinnerId = body.tossWinnerId ?? null
  const tossDecision = body.tossDecision ?? null

  // Validate: winner must be one of the two teams (or null to clear)
  if (tossWinnerId && tossWinnerId !== match.team1Id && tossWinnerId !== match.team2Id) {
    return NextResponse.json(
      { error: "tossWinnerId must be one of the match's two teams" },
      { status: 400 }
    )
  }
  if (tossDecision && tossDecision !== "bat" && tossDecision !== "bowl") {
    return NextResponse.json(
      { error: 'tossDecision must be "bat" or "bowl"' },
      { status: 400 }
    )
  }

  const updated = await db.match.update({
    where: { id },
    data: { tossWinnerId, tossDecision },
    include: { team1: true, team2: true, series: true },
  })
  return NextResponse.json(serializeMatch(updated))
}
