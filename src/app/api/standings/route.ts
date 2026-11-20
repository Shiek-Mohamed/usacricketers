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

  const [matches, teamsInSeries, penalties, seriesCfg] = await Promise.all([
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
    db.series.findUnique({
      where: { id: seriesId },
      select: { winPoints: true, lossPoints: true, tiePoints: true, abandonedPoints: true, bonusPoints: true, rankCriteria: true },
    }),
  ])
  // Points system + ranking criteria for this series. Defaults match the
  // schema defaults so a series created before this feature still computes
  // the classic 2/1/0 + points→NRR→wins table.
  const cfg = {
    winPoints: seriesCfg?.winPoints ?? 2,
    lossPoints: seriesCfg?.lossPoints ?? 0,
    tiePoints: seriesCfg?.tiePoints ?? 1,
    abandonedPoints: seriesCfg?.abandonedPoints ?? 1,
    bonusPoints: seriesCfg?.bonusPoints ?? 0,
    rankCriteria: seriesCfg?.rankCriteria ?? "points,nrr,headToHead,wins,winPercentage",
  }

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
    const isNoResult = result.includes("no result")
    // Abandoned / no-play (match didn't happen) — not counted as played.
    if (!result || ((result.includes("abandoned") || result.includes("no play")) && !isNoResult)) continue

    t1.played++
    t2.played++

    // No-result match (started, no result) — both teams get abandonedPoints,
    // no runs/wickets counted toward NRR.
    if (isNoResult) {
      t1.points += cfg.abandonedPoints
      t2.points += cfg.abandonedPoints
      continue
    }

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
      t1.points += cfg.tiePoints; t2.points += cfg.tiePoints
    } else {
      const t1Won = result.includes(t1.teamName.toLowerCase()) || result.includes(t1.teamShortName.toLowerCase())
      const t2Won = result.includes(t2.teamName.toLowerCase()) || result.includes(t2.teamShortName.toLowerCase())
      if (t1Won && !t2Won) {
        t1.won++; t2.lost++
        t1.points += cfg.winPoints + cfg.bonusPoints
        t2.points += cfg.lossPoints
      } else if (t2Won && !t1Won) {
        t2.won++; t1.lost++
        t2.points += cfg.winPoints + cfg.bonusPoints
        t1.points += cfg.lossPoints
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

  // Head-to-head wins map — h2h.get(`${aId}|${bId}`) = number of times team a
  // beat team b. Used by the headToHead tie-breaker.
  const h2h = new Map<string, number>()
  for (const m of matches) {
    const result = (m.result || "").toLowerCase()
    if (!result || result.includes("abandoned") || result.includes("no result") || result.includes("no play") || result.includes("tied")) continue
    const r1 = map.get(m.team1Id)
    const r2 = map.get(m.team2Id)
    if (!r1 || !r2) continue
    const w1 = result.includes(r1.teamName.toLowerCase()) || result.includes(r1.teamShortName.toLowerCase())
    const w2 = result.includes(r2.teamName.toLowerCase()) || result.includes(r2.teamShortName.toLowerCase())
    if (w1 && !w2) h2h.set(`${m.team1Id}|${m.team2Id}`, (h2h.get(`${m.team1Id}|${m.team2Id}`) ?? 0) + 1)
    else if (w2 && !w1) h2h.set(`${m.team2Id}|${m.team1Id}`, (h2h.get(`${m.team2Id}|${m.team1Id}`) ?? 0) + 1)
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

  // Rank by the series' configured tie-breaker order (default points→NRR→wins).
  const criteria = cfg.rankCriteria.split(",").map((s) => s.trim()).filter(Boolean)
  const order = criteria.length > 0 ? criteria : ["points", "nrr", "wins"]
  const standings = Array.from(map.values())
    .filter((s) => s.played > 0) // only show teams that have played at least 1 match
    .sort((a, b) => {
      for (const c of order) {
        let diff = 0
        if (c === "points") diff = b.effectivePoints - a.effectivePoints
        else if (c === "nrr") diff = b.effectiveNrr - a.effectiveNrr
        else if (c === "wins") diff = b.won - a.won
        else if (c === "headToHead") {
          const ab = h2h.get(`${a.teamId}|${b.teamId}`) ?? 0
          const ba = h2h.get(`${b.teamId}|${a.teamId}`) ?? 0
          diff = ba - ab
        }
        else if (c === "winPercentage") {
          const aPct = a.played > 0 ? (a.won / a.played) * 100 : 0
          const bPct = b.played > 0 ? (b.won / b.played) * 100 : 0
          diff = bPct - aPct
        }
        if (diff !== 0) return diff
      }
      return 0
    })

  const res = NextResponse.json(standings)
  res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60")
  return res
}
