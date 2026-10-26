import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseScorecard } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * GET /api/embed/match/[id]
 * Returns a minimal JSON payload for the embeddable live-score widget.
 * Partner sites can embed the iframe at /embed/match/[id] or fetch this
 * JSON directly for a custom widget.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const match = await db.match.findUnique({
    where: { id },
    include: { team1: true, team2: true, series: true },
  })

  if (!match) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const sc = parseScorecard(match.scorecard)
  let currentScore: { batting: string; score: string; overs: string } | null = null

  if (sc && sc.innings.length > 0) {
    const lastInn = sc.innings[sc.innings.length - 1]
    if (lastInn) {
      currentScore = {
        batting: lastInn.teamShortName,
        score: `${lastInn.totalRuns}/${lastInn.totalWickets}`,
        overs: lastInn.totalOvers,
      }
    }
  }

  const res = NextResponse.json({
    match: {
      id: match.id,
      format: match.format,
      matchNo: match.matchNo,
      status: match.status,
      result: match.result,
      venue: match.venue,
      team1: match.team1 ? { name: match.team1.name, shortName: match.team1.shortName, primaryColor: match.team1.primaryColor } : null,
      team2: match.team2 ? { name: match.team2.name, shortName: match.team2.shortName, primaryColor: match.team2.primaryColor } : null,
      series: match.series ? { name: match.series.name, shortName: match.series.shortName } : null,
      currentScore,
    },
    lastUpdated: new Date().toISOString(),
  })

  if (match.status === "live") {
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10")
  } else {
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
  }
  res.headers.set("Access-Control-Allow-Origin", "*")
  return res
}
