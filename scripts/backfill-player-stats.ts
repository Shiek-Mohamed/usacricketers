#!/usr/bin/env bun
/**
 * scripts/backfill-player-stats.ts
 *
 * Aggregates batting + bowling stats for every player by scanning all
 * match scorecards in the DB. Updates Player.battingStats and
 * Player.bowlingStats (stored as JSON strings) with career aggregates:
 *   matches, innings, runs, balls, highest, average, strikeRate,
 *   hundreds, fifties, fours, sixes, notOuts (batting)
 *   matches, innings, balls, runs, wickets, best, economy, average,
 *   strikeRate, maidens (bowling)
 *
 * Usage:
 *   bun run scripts/backfill-player-stats.ts              # compute + save
 *   bun run scripts/backfill-player-stats.ts --dry-run    # preview without saving
 */

import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

const DRY_RUN = process.argv.includes("--dry-run")

interface BattingAgg {
  matches: number
  innings: number
  runs: number
  balls: number
  fours: number
  sixes: number
  highest: number // numeric for comparison
  highestStr: string // display string
  notOuts: number
  hundreds: number
  fifties: number
  dismissals: number
}

interface BowlingAgg {
  matches: number
  innings: number
  balls: number
  runs: number
  wickets: number
  maidens: number
  bestWickets: number
  bestRuns: number
  bestStr: string
}

/** Parse overs string like "8.2" → number of balls (8*6 + 2 = 50). */
function oversToBalls(overs: string | number): number {
  const s = String(overs || "0")
  const [o, b] = s.split(".").map(Number)
  return (o || 0) * 6 + (b || 0)
}

async function main() {
  console.log(" Player stats backfill")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN" : "SAVE"}`)
  console.log("")

  // Get all matches with scorecards
  const matches = await db.match.findMany({
    where: { scorecard: { not: "" } },
    select: {
      id: true,
      team1Id: true,
      team2Id: true,
      scorecard: true,
      team1: { select: { name: true } },
      team2: { select: { name: true } },
    },
  })
  console.log(`  Found ${matches.length} matches with scorecards`)

  // Aggregate stats per player, keyed by "teamId:playerName"
  const battingMap = new Map<string, BattingAgg>()
  const bowlingMap = new Map<string, BowlingAgg>()
  const playerTeams = new Map<string, string>() // "teamId:name" → teamId

  for (const match of matches) {
    let sc: any
    try {
      sc = JSON.parse(match.scorecard)
    } catch {
      continue
    }
    if (!sc?.innings) continue

    for (const inn of sc.innings) {
      const teamId = inn.teamId
      if (!teamId) continue

      // Process batting
      for (const batter of inn.batting ?? []) {
        const name = batter.name
        if (!name) continue
        const key = `${teamId}:${name}`
        playerTeams.set(key, teamId)

        let agg = battingMap.get(key)
        if (!agg) {
          agg = {
            matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
            highest: 0, highestStr: "0", notOuts: 0, hundreds: 0, fifties: 0,
            dismissals: 0,
          }
          battingMap.set(key, agg)
        }

        agg.matches++
        agg.innings++
        agg.runs += batter.runs || 0
        agg.balls += batter.balls || 0
        agg.fours += batter.fours || 0
        agg.sixes += batter.sixes || 0

        const runs = batter.runs || 0
        const isNotOut = !batter.dismissal || batter.dismissal === "not out"
        if (isNotOut) agg.notOuts++
        else agg.dismissals++

        if (runs > agg.highest) {
          agg.highest = runs
          agg.highestStr = isNotOut ? `${runs}*` : `${runs}`
        }

        if (runs >= 100) agg.hundreds++
        else if (runs >= 50) agg.fifties++
      }

      // Process bowling
      for (const bowler of inn.bowling ?? []) {
        const name = bowler.name
        if (!name) continue
        const key = `${teamId}:${name}`
        playerTeams.set(key, teamId)

        let agg = bowlingMap.get(key)
        if (!agg) {
          agg = {
            matches: 0, innings: 0, balls: 0, runs: 0, wickets: 0,
            maidens: 0, bestWickets: 0, bestRuns: Infinity, bestStr: "—",
          }
          bowlingMap.set(key, agg)
        }

        agg.matches++
        agg.innings++
        agg.balls += oversToBalls(bowler.overs)
        agg.runs += bowler.runs || 0
        agg.wickets += bowler.wickets || 0
        agg.maidens += bowler.maidens || 0

        // Track best bowling (most wickets, then fewest runs)
        const wkts = bowler.wickets || 0
        const rns = bowler.runs || 0
        if (wkts > agg.bestWickets || (wkts === agg.bestWickets && rns < agg.bestRuns)) {
          agg.bestWickets = wkts
          agg.bestRuns = rns
          agg.bestStr = `${wkts}/${rns}`
        }
      }
    }
  }

  console.log(`  Aggregated stats for ${battingMap.size} batters, ${bowlingMap.size} bowlers`)

  if (DRY_RUN) {
    // Show top 10 by runs
    const top = [...battingMap.entries()]
      .map(([key, agg]) => ({ name: key.split(":")[1], ...agg }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 10)
    console.log("\n  Top 10 batters (dry-run):")
    for (const p of top) {
      console.log(`    ${p.name.padEnd(25)} ${p.runs} runs @ ${p.matches}m, ${p.hundreds}x100, ${p.fifties}x50`)
    }
    return
  }

  // Save to DB
  console.log("")
  console.log("→ Saving to DB…")
  let updated = 0

  for (const [key, battingAgg] of battingMap) {
    const [teamId, name] = key.split(":")
    const bowlingAgg = bowlingMap.get(key)

    // Compute batting stats
    const battingAverage = battingAgg.dismissals > 0
      ? Math.round((battingAgg.runs / battingAgg.dismissals) * 100) / 100
      : battingAgg.runs
    const battingStrikeRate = battingAgg.balls > 0
      ? Math.round((battingAgg.runs / battingAgg.balls) * 1000) / 10
      : 0

    const battingStats = JSON.stringify({
      matches: battingAgg.matches,
      innings: battingAgg.innings,
      runs: battingAgg.runs,
      highest: battingAgg.highestStr,
      average: battingAverage,
      strikeRate: battingStrikeRate,
      hundreds: battingAgg.hundreds,
      fifties: battingAgg.fifties,
      fours: battingAgg.fours,
      sixes: battingAgg.sixes,
      notOuts: battingAgg.notOuts,
    })

    // Compute bowling stats
    let bowlingStats = "{}"
    if (bowlingAgg) {
      const oversFloat = bowlingAgg.balls / 6
      const economy = oversFloat > 0
        ? Math.round((bowlingAgg.runs / oversFloat) * 100) / 100
        : 0
      const bowlingAverage = bowlingAgg.wickets > 0
        ? Math.round((bowlingAgg.runs / bowlingAgg.wickets) * 100) / 100
        : 0
      const bowlingStrikeRate = bowlingAgg.wickets > 0
        ? Math.round((bowlingAgg.balls / bowlingAgg.wickets) * 10) / 10
        : 0

      bowlingStats = JSON.stringify({
        matches: bowlingAgg.matches,
        innings: bowlingAgg.innings,
        balls: bowlingAgg.balls,
        runs: bowlingAgg.runs,
        wickets: bowlingAgg.wickets,
        best: bowlingAgg.bestStr,
        economy,
        average: bowlingAverage,
        strikeRate: bowlingStrikeRate,
        maidens: bowlingAgg.maidens,
      })
    }

    // Update the player
    const player = await db.player.findFirst({ where: { name, teamId } })
    if (player) {
      await db.player.update({
        where: { id: player.id },
        data: { battingStats, bowlingStats },
      })
      updated++
    }
  }

  console.log(`\n✓ Updated ${updated} players with career stats`)

  // Summary
  const totalPlayers = await db.player.count()
  const withStats = await db.player.count({ where: { battingStats: { not: "{}" } } })
  console.log(`Players with batting stats: ${withStats}/${totalPlayers}`)
}

main().catch((e) => {
  console.error("✗ Fatal error:", e)
  process.exit(1)
})
