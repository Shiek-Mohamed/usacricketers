import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

// List matches across all the admin's managed leagues (optionally ?seriesId=).
export async function GET(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { managedSeriesIds } = auth.ctx
  if (managedSeriesIds.length === 0) return NextResponse.json([])
  const url = new URL(req.url)
  const seriesId = url.searchParams.get("seriesId")
  const where: Record<string, unknown> = { seriesId: { in: managedSeriesIds } }
  if (seriesId) {
    if (!managedSeriesIds.includes(seriesId)) {
      return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
    }
    where.seriesId = seriesId
  }
  const matches = await db.match.findMany({
    where,
    include: { team1: true, team2: true, series: true },
    orderBy: { startDate: "asc" },
  })
  return NextResponse.json(matches.map(serializeMatch))
}

// Create a match in one of the admin's managed leagues.
export async function POST(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { managedSeriesIds } = auth.ctx
  try {
    const body = await req.json()
    const seriesId = String(body.seriesId || "")
    if (!seriesId || !managedSeriesIds.includes(seriesId)) {
      return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
    }
    const team1Id = String(body.team1Id || "")
    const team2Id = String(body.team2Id || "")
    if (!team1Id || !team2Id || team1Id === team2Id) {
      return NextResponse.json({ error: "two distinct teams required" }, { status: 400 })
    }
    // Teams must be participants in this league.
    const inLeague = await db.tournamentTeam.findMany({
      where: { seriesId, teamId: { in: [team1Id, team2Id] } },
    })
    if (inLeague.length !== 2) {
      return NextResponse.json(
        { error: "both teams must be participants in this league" },
        { status: 400 }
      )
    }
    const created = await db.match.create({
      data: {
        seriesId,
        team1Id,
        team2Id,
        format: String(body.format || "T20"),
        matchNo: String(body.matchNo || "Match"),
        status: String(body.status || "upcoming"),
        venue: String(body.venue || ""),
        city: String(body.city || ""),
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        result: "",
        scorecard: "",
        umpires: String(body.umpires || ""),
        tvUmpire: String(body.tvUmpire || ""),
        referee: String(body.referee || ""),
      },
      include: { team1: true, team2: true, series: true },
    })
    return NextResponse.json(serializeMatch(created))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
