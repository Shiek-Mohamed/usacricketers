import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseScorecard } from "@/lib/types"

export const dynamic = "force-dynamic"

interface BatAgg {
  matches: number
  innings: number
  runs: number
  balls: number
  fours: number
  sixes: number
  notOuts: number
  hundreds: number
  fifties: number
  highest: number
}

interface BowlAgg {
  matches: number
  balls: number
  runs: number
  wickets: number
  maidens: number
  wides: number
  noballs: number
}

/** GET /api/players/:id/stats — auto-computes career stats from all match
 * scorecards where this player appears (by playerId or name match). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const player = await db.player.findUnique({
    where: { id },
    select: { name: true, teamId: true },
  })
  if (!player) return NextResponse.json({ error: "not found" }, { status: 404 })

  // Fetch all completed matches involving this player's team
  const matches = await db.match.findMany({
    where: {
      status: "completed",
      OR: [{ team1Id: player.teamId }, { team2Id: player.teamId }],
    },
    select: {
      scorecard: true,
      format: true,
      matchNo: true,
      startDate: true,
      team1Id: true,
      team2Id: true,
      team1: { select: { shortName: true } },
      team2: { select: { shortName: true } },
    },
    orderBy: { startDate: "desc" },
  })

  const bat: BatAgg = {
    matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
    notOuts: 0, hundreds: 0, fifties: 0, highest: 0,
  }
  const bowl: BowlAgg = {
    matches: 0, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0,
  }
  const formatsPlayed = new Set<string>()
  const recentInnings: {
    runs: number
    balls: number
    fours: number
    sixes: number
    strikeRate: number
    dismissal: string
    opponent: string
    matchNo: string
    format: string
    date: string
  }[] = []

  for (const m of matches) {
    const sc = parseScorecard(m.scorecard)
    if (!sc?.innings) continue
    let battedInThisMatch = false
    let bowledInThisMatch = false

    for (const inn of sc.innings) {
      // Only count innings where this player's team batted
      // (the innings' teamId is the batting team)
      // Find this player in the batting lines
      for (const b of inn.batting) {
        const isPlayer =
          (b.playerId && b.playerId === id) ||
          b.name.toLowerCase() === player.name.toLowerCase()
        if (!isPlayer || b.name === "Extras") continue
        battedInThisMatch = true
        bat.innings++
        bat.runs += b.runs
        bat.balls += b.balls
        bat.fours += b.fours
        bat.sixes += b.sixes
        if (b.runs > bat.highest) bat.highest = b.runs
        if (b.runs >= 100) bat.hundreds++
        else if (b.runs >= 50) bat.fifties++
        if (b.dismissal && b.dismissal.toLowerCase().includes("not out")) {
          bat.notOuts++
        }
        // Collect recent innings (opponent = the team that's NOT the player's team)
        const opponent = m.team1Id === player.teamId
          ? m.team2?.shortName ?? "?"
          : m.team1?.shortName ?? "?"
        recentInnings.push({
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          strikeRate: b.balls > 0 ? Number(((b.runs / b.balls) * 100).toFixed(1)) : 0,
          dismissal: b.dismissal,
          opponent,
          matchNo: m.matchNo,
          format: m.format,
          date: m.startDate.toISOString(),
        })
      }
      // Find this player in the bowling lines
      for (const b of inn.bowling ?? []) {
        const isPlayer =
          (b.playerId && b.playerId === id) ||
          b.name.toLowerCase() === player.name.toLowerCase()
        if (!isPlayer) continue
        bowledInThisMatch = true
        bowl.balls += Math.round(parseFloat(b.overs) * 6) || 0
        bowl.runs += b.runs
        bowl.wickets += b.wickets
        bowl.maidens += b.maidens
        bowl.wides += b.wides || 0
        bowl.noballs += b.noballs || 0
      }
    }
    if (battedInThisMatch || bowledInThisMatch) {
      bat.matches++
      bowl.matches++
      formatsPlayed.add(m.format)
    }
  }

  // Compute derived stats
  const battingAverage =
    bat.innings - bat.notOuts > 0
      ? Number((bat.runs / (bat.innings - bat.notOuts)).toFixed(2))
      : 0
  const battingStrikeRate =
    bat.balls > 0 ? Number(((bat.runs / bat.balls) * 100).toFixed(2)) : 0
  const bowlingEconomy =
    bowl.balls > 0 ? Number(((bowl.runs / bowl.balls) * 6).toFixed(2)) : 0
  const bowlingAverage =
    bowl.wickets > 0 ? Number((bowl.runs / bowl.wickets).toFixed(2)) : 0
  const bowlingStrikeRate =
    bowl.wickets > 0 ? Number((bowl.balls / bowl.wickets).toFixed(2)) : 0

  return NextResponse.json({
    batting: {
      ...bat,
      average: battingAverage,
      strikeRate: battingStrikeRate,
      formats: Array.from(formatsPlayed),
    },
    bowling: {
      ...bowl,
      overs: bowl.balls > 0 ? `${Math.floor(bowl.balls / 6)}.${bowl.balls % 6}` : "0",
      economy: bowlingEconomy,
      average: bowlingAverage,
      strikeRate: bowlingStrikeRate,
      best: `${bowl.wickets}/${bowl.runs}`,
    },
    matchesScored: matches.length,
    recentInnings: recentInnings.slice(0, 5),
  })
}
