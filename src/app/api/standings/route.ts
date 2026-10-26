import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Match } from "@/lib/types"
import { parseScorecard } from "@/lib/types"

/**
 * GET /api/standings?seriesId=X
 * Computes standings on-the-fly from all completed matches in the series.
 * No manual maintenance needed — always reflects the latest match results.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seriesId = searchParams.get("seriesId")
  if (!seriesId) return NextResponse.json([])

  const matches = await db.match.findMany({
    where: { seriesId, status: "completed" },
    include: { team1: true, team2: true },
  })

  const teamsInSeries = await db.tournamentTeam.findMany({
    where: { seriesId },
    include: { team: true },
  })

  // Initialize standings for every team in the series.
  type Standing = {
    teamId: string
    teamName: string
    teamShortName: string
    primaryColor: string
    played: number
    won: number
    lost: number
    tied: number
    points: number
    forRuns: number
    forOvers: number
    againstRuns: number
    againstOvers: number
    nrr: number
  }

  const map = new Map<string, Standing>()
  for (const tt of teamsInSeries) {
    map.set(tt.teamId, {
      teamId: tt.teamId,
      teamName: tt.team.name,
      teamShortName: tt.team.shortName,
      primaryColor: tt.team.primaryColor,
      played: 0, won: 0, lost: 0, tied: 0, points: 0,
      forRuns: 0, forOvers: 0, againstRuns: 0, againstOvers: 0, nrr: 0,
    })
  }

  for (const m of matches) {
    const t1 = map.get(m.team1Id)
    const t2 = map.get(m.team2Id)
    if (!t1 || !t2) continue

    const result = (m.result || "").toLowerCase()
    if (!result || result.includes("abandoned") || result.includes("no result") || result.includes("no play")) continue

    t1.played++
    t2.played++

    // Try to get innings totals from the scorecard.
    const sc = parseScorecard(m.scorecard)
    let t1Runs = 0, t2Runs = 0, t1Overs = 0, t2Overs = 0

    if (sc && sc.innings.length >= 2) {
      for (const inn of sc.innings) {
        if (inn.teamId === m.team1Id) {
          t1Runs += inn.totalRuns
          t1Overs += parseFloat(inn.totalOvers) || 0
        } else if (inn.teamId === m.team2Id) {
          t2Runs += inn.totalRuns
          t2Overs += parseFloat(inn.totalOvers) || 0
        }
      }
      t1.forRuns += t1Runs; t1.forOvers += t1Overs
      t1.againstRuns += t2Runs; t1.againstOvers += t2Overs
      t2.forRuns += t2Runs; t2.forOvers += t2Overs
      t2.againstRuns += t1Runs; t2.againstOvers += t1Overs
    }

    if (result.includes("tied")) {
      t1.tied++; t2.tied++
      t1.points += 1; t2.points += 1
    } else {
      const t1Won = result.includes(t1.teamName.toLowerCase()) || result.includes(t1.teamShortName.toLowerCase())
      const t2Won = result.includes(t2.teamName.toLowerCase()) || result.includes(t2.teamShortName.toLowerCase())
      if (t1Won && !t2Won) {
        t1.won++; t2.lost++
        t1.points += 2
      } else if (t2Won && !t1Won) {
        t2.won++; t1.lost++
        t2.points += 2
      } else {
        // Can't determine — skip
      }
    }
  }

  // Compute NRR: (forRuns / forOvers) - (againstRuns / againstOvers)
  for (const s of map.values()) {
    const forRR = s.forOvers > 0 ? s.forRuns / s.forOvers : 0
    const againstRR = s.againstOvers > 0 ? s.againstRuns / s.againstOvers : 0
    s.nrr = Number((forRR - againstRR).toFixed(3))
  }

  const standings = Array.from(map.values())
    .filter((s) => s.played > 0) // only show teams that have played at least 1 match
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won)

  const res = NextResponse.json(standings)
  res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
  return res
}
