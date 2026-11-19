import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/players/copy-sources?excludeTeamId=<teamId>
 *
 * Powers the "Copy roster from a previous series" picker in the
 * bulk-players dialog. Returns recent series (newest first) with the teams
 * that actually have players, plus a per-team player count, so an admin can
 * pick "Champions Trophy 2025 → India (15)" and duplicate that roster into
 * a new team with one click (the copy itself is POST /api/players/copy).
 *
 * Series with no eligible teams (empty rosters, or the only team is the
 * one being edited) are omitted entirely.
 *
 * Public read — exposes only names + counts, the same information already
 * served by GET /api/series and GET /api/teams.
 *
 * Returns: 200 { sources: CopySource[] }
 */
export async function GET(req: NextRequest) {
  const excludeTeamId = req.nextUrl.searchParams.get("excludeTeamId") ?? ""

  const series = await db.series.findMany({
    orderBy: { startDate: "desc" },
    take: 12,
    include: {
      tournamentTeams: {
        include: {
          team: { include: { _count: { select: { players: true } } } },
        },
      },
    },
  })

  const sources = series
    .map((s) => ({
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      season: s.season,
      format: s.format,
      status: s.status,
      teams: s.tournamentTeams
        .map((tt) => tt.team)
        .filter((t) => t.id !== excludeTeamId && t._count.players > 0)
        .map((t) => ({
          id: t.id,
          name: t.name,
          shortName: t.shortName,
          playerCount: t._count.players,
        }))
        .sort((a, b) => b.playerCount - a.playerCount),
    }))
    .filter((s) => s.teams.length > 0)

  const res = NextResponse.json({ sources })
  res.headers.set("Cache-Control", "no-store")
  return res
}
