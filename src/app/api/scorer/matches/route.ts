import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyScorerToken } from "@/lib/scorer-auth"
import { serializeMatch } from "@/lib/serialize"

export const dynamic = "force-dynamic"

// GET /api/scorer/matches  (Authorization: Bearer <token>)
// Returns the matches belonging to any of the scorer's assigned tournaments,
// newest first, regardless of status. Empty array if the scorer has no
// assignments.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const token = auth.slice("Bearer ".length).trim()
  const payload = verifyScorerToken(token)
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Re-read assignments from DB (admin may have changed them).
  const scorer = await db.scorer.findUnique({
    where: { id: payload.scorerId },
    include: { assignments: true },
  })
  if (!scorer || !scorer.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tournamentIds = scorer.assignments.map((a) => a.seriesId)
  if (tournamentIds.length === 0) {
    return NextResponse.json([])
  }

  const matches = await db.match.findMany({
    where: { seriesId: { in: tournamentIds } },
    include: {
      team1: true,
      team2: true,
      series: { include: { tournamentTeams: { include: { team: true } } } },
    },
    orderBy: { startDate: "desc" },
  })

  return NextResponse.json(matches.map(serializeMatch))
}
