import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseScorecard } from "@/lib/types"

/**
 * GET /api/standings?seriesId=X
 * Computes standings on-the-fly from all completed matches in the series,
 * then applies any Penalties & Deductions (points deductions / NRR
 * adjustments) on top. The raw match-derived points/NRR are never mutated —
 * penalties are returned alongside as `penaltyPoints` / `penaltyNrr` and the
 * already-applied `effectivePoints` / `effectiveNrr` used for sorting.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seriesId = searchParams.get("seriesId")
  if (!seriesId) return NextResponse.json([])

  const [matches, teamsInSeries, penalties] = await Promise.all([
    db.match.findMany({
      where: { seriesId, status: "completed" },
      include: { team1: true, team2: true },
    }),
    db.tournamentTeam.findMany({
      where: { seriesId },
      include: { team: true },
    }),
    db.penalty.findMany({
      where: { seriesId },
      include: { team: { select: { name: true, shortName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  type PenaltyInfo = { id: string; type: string; value: number; reason: string }
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
    penaltyPoints: number
    penaltyNrr: number
    effectivePoints: number
    effectiveNrr: number
    penalties: PenaltyInfo[]
  }

  const map = new Map<string, Standing>()
  const ensureRow = (
    teamId: string,
    name: string,
    shortName: string,
    primaryColor: string,
  ) => {
    let row = map.get(teamId)
    if (!row) {
      row = {
        teamId,
        teamName: name,
        teamShortName: shortName,
        primaryColor,
        played: 0, won: 0, lost: 0, tied: 0, points: 0,
        forRuns: 0, forOvers: 0, againstRuns: 0, againstOvers: 0, nrr: 0,
        penaltyPoints: 0, penaltyNrr: 0, effectivePoints: 0, effectiveNrr: 0,
        penalties: [],
      }
      map.set(teamId, row)
    }
    return row
  }
  for (const tt of teamsInSeries) {
    ensureRow(tt.teamId, tt.team.name, tt.team.shortName, tt.team.primaryColor)
  }
  // TournamentTeam isn't always populated — also seed from every team that
  // appears in a completed match so standings still list them.
  for (const m of matches) {
    if (m.team1) ensureRow(m.team1Id, m.team1.name, m.team1.shortName, m.team1.primaryColor)
    if (m.team2) ensureRow(m.team2Id, m.team2.name, m.team2.shortName, m.team2.primaryColor)
  }

  for (const m of matches) {
    const t1 = map.get(m.team1Id)
    const t2 = map.get(m.team2Id)
    if (!t1 || !t2) continue

    const result = (m.result || "").toLowerCase()
    if (!result || result.includes("abandoned") || result.includes("no result") || result.includes("no play")) continue

    t1.played++
    t2.played++

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

  // Apply penalties. type="points" deducts `value` points; type="nrr" adds
  // the signed `value` to NRR. Penalties on teams not in this series'
  // TournamentTeam set are ignored here (no row to attach to).
  for (const p of penalties) {
    const row = map.get(p.teamId)
    if (!row) continue
    row.penalties.push({ id: p.id, type: p.type, value: p.value, reason: p.reason })
    if (p.type === "points") {
      row.penaltyPoints += p.value
    } else if (p.type === "nrr") {
      row.penaltyNrr += p.value
    }
  }
  for (const s of map.values()) {
    s.effectivePoints = s.points - s.penaltyPoints
    s.effectiveNrr = Number((s.nrr + s.penaltyNrr).toFixed(3))
  }

  const standings = Array.from(map.values())
    .filter((s) => s.played > 0) // only show teams that have played at least 1 match
    .sort((a, b) => b.effectivePoints - a.effectivePoints || b.effectiveNrr - a.effectiveNrr || b.won - a.won)

  const res = NextResponse.json(standings)
  res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60")
  return res
}
