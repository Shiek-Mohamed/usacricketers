#!/usr/bin/env bun
/**
 * scripts/fetch-scorecards.ts
 *
 * Backfills full scorecards for CricAPI matches that were scraped with
 * --no-scorecard. Fetches the scorecard JSON from CricAPI's
 * /v1/match_scorecard endpoint and saves it to Match.scorecard.
 *
 * Also extracts player names from scorecards and creates Player rows
 * (with role inferred from batting/bowling position).
 *
 * Usage:
 *   bun run scripts/fetch-scorecards.ts              # fetch + save
 *   bun run scripts/fetch-scorecards.ts --dry-run    # preview without saving
 *   bun run scripts/fetch-scorecards.ts --limit 5    # only process 5 matches
 */

import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const limitIdx = args.indexOf("--limit")
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) || 0 : 0

const API_KEY = process.env.CRICAPI_KEY
const API_BASE = "https://api.cricapi.com/v1"
const CRICAPI_IP_FALLBACK = "135.181.170.35"

if (!API_KEY) {
  console.error("✗ CRICAPI_KEY is not set")
  process.exit(1)
}

interface CricScorecardResponse {
  matchId?: string
  name?: string
  venue?: string
  status?: string
  teamInfo?: { name: string; shortname: string; imgUrl?: string }[]
  scorecard?: {
    inning?: string
    batting?: { batsman?: string | { name?: string }; runs?: number; balls?: number; fours?: number; sixes?: number; out?: string }[]
    bowling?: { bowler?: string | { name?: string }; overs?: string; maidens?: number; runs?: number; wickets?: number; economy?: number }[]
  }[]
}

async function fetchJSON(url: string): Promise<any> {
  let firstErr: any = null
  try {
    const res = await fetch(url)
    if (res.ok) return res.json()
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  } catch (err: any) {
    firstErr = err
    const code = err?.code || ""
    const msg = err?.message || ""
    if (!/ENOTFOUND|EAI_AGAIN|ConnectionRefused|Could not resolve|Unable to connect|HTTP 429|HTTP 5\d\d/i.test(code + " " + msg)) throw err
    console.log(`  ⚠️  Retry needed (${code || msg.slice(0, 30)})`)
  }
  // Retry with pinned IP
  const u = new URL(url)
  const pinnedUrl = url.replace(`https://${u.hostname}`, `https://${CRICAPI_IP_FALLBACK}`)
  try {
    const res = await fetch(pinnedUrl, {
      headers: { Host: u.hostname },
      // @ts-ignore
      tls: { rejectUnauthorized: false, servername: u.hostname },
    })
    if (res.ok) return res.json()
  } catch (err: any) {
    // Fall through to throw original error
  }
  throw firstErr || new Error("fetch failed")
}

/** Extract a player name from either a string or {name: "..."} object. */
function playerName(v: string | { name?: string } | undefined): string {
  if (!v) return ""
  if (typeof v === "string") return v
  return v.name || ""
}

/** Convert CricAPI scorecard format → internal format expected by the frontend.
 *  CricAPI: [{inning: "India Inning 1", batting: [{batsman: {name}, runs, balls, ...}], bowling: [...]}]
 *  Internal: {note: "...", innings: [{teamId, teamShortName, totalRuns, totalWickets, totalOvers, batting: [{name, runs, ...}], bowling: [...]}]} */
function convertScorecard(
  cricScorecard: CricScorecardResponse["scorecard"],
  team1Id: string,
  team2Id: string,
  team1Name: string,
  team2Name: string,
  team1Short: string,
  team2Short: string,
): { note: string; innings: any[] } {
  const innings = (cricScorecard ?? []).map((inn) => {
    // Determine which team this inning belongs to by matching the inning
    // name (e.g., "India Inning 1") against team names.
    const inningName = (inn.inning || "").toLowerCase()
    const isTeam1 = inningName.includes(team1Name.toLowerCase())
    const isTeam2 = inningName.includes(team2Name.toLowerCase())
    const teamId = isTeam2 ? team2Id : team1Id // default to team1 if unclear
    const teamShortName = isTeam2 ? team2Short : team1Short

    // Convert batting lines
    const batting = (inn.batting ?? []).map((b) => {
      const name = playerName(b.batsman)
      const runs = b.runs || 0
      const balls = b.balls || 0
      return {
        name,
        runs,
        balls,
        fours: b.fours || 0,
        sixes: b.sixes || 0,
        strikeRate: balls > 0 ? Math.round((runs / balls) * 1000) / 10 : 0,
        dismissal: b.out || "",
        isBatting: false, // completed match
      }
    })

    // Convert bowling lines
    const bowling = (inn.bowling ?? []).map((b) => {
      const name = playerName(b.bowler)
      const overs = b.overs || "0"
      const oversFloat = parseFloat(overs) || 0
      const runs = b.runs || 0
      const wickets = b.wickets || 0
      return {
        name,
        overs,
        maidens: b.maidens || 0,
        runs,
        wickets,
        economy: oversFloat > 0 ? Math.round((runs / oversFloat) * 100) / 100 : 0,
      }
    })

    // Calculate innings totals from batting
    const totalRuns = batting.reduce((sum, b) => sum + b.runs, 0)
    const totalWickets = batting.filter((b) => b.dismissal && b.dismissal !== "not out").length
    // Total overs = the last bowler's overs (represents the innings total)
    const totalOvers = bowling.length > 0 ? bowling[bowling.length - 1].overs : "0"

    return {
      teamId,
      teamShortName,
      total: `${totalRuns}/${totalWickets}`,
      totalRuns,
      totalWickets,
      totalOvers: totalOvers,
      declared: false,
      batting,
      bowling,
    }
  })

  return { note: "", innings }
}

/** Parse overs string like "8.2" → number of balls (8*6 + 2 = 50). */
function oversToBalls(overs: string): number {
  const [o, b] = (overs || "0").split(".").map(Number)
  return (o || 0) * 6 + (b || 0)
}

async function main() {
  console.log(" Scorecard backfill")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN" : "SAVE"}`)
  if (LIMIT) console.log(`  Limit: ${LIMIT}`)
  console.log("")

  // Step 1: Fetch current matches from CricAPI to get their IDs
  console.log("→ Fetching current matches from CricAPI to get match IDs…")
  const matchesData = await fetchJSON(`${API_BASE}/currentMatches?apikey=${API_KEY}&offset=0`)
  if (matchesData.status !== "success") {
    console.error("✗ CricAPI error:", matchesData)
    process.exit(1)
  }
  const cricMatches = (matchesData.data ?? []) as any[]
  console.log(`  ✓ ${cricMatches.length} matches from CricAPI`)

  // Step 2: Find DB matches that need scorecards (completed + no scorecard)
  const dbMatches = await db.match.findMany({
    where: { status: "completed", scorecard: "" },
    select: { id: true, matchNo: true, startDate: true, team1Id: true, team2Id: true,
              team1: { select: { name: true } }, team2: { select: { name: true } } },
  })
  console.log(`  ✓ ${dbMatches.length} DB matches need scorecards`)

  // Step 3: Match CricAPI matches to DB matches by team names + date proximity
  interface MatchPair {
    dbMatch: typeof dbMatches[0]
    cricMatchId: string
    cricMatchName: string
  }
  const pairs: MatchPair[] = []
  for (const dbm of dbMatches) {
    const dbDate = dbm.startDate.getTime()
    for (const cm of cricMatches) {
      if (!cm.teamInfo || cm.teamInfo.length < 2) continue
      const cmDate = cm.dateTimeGMT ? new Date(cm.dateTimeGMT).getTime() : 0
      const dateClose = Math.abs(dbDate - cmDate) < 48 * 60 * 60 * 1000 // 48h window
      const teamMatch =
        (cm.teamInfo[0]?.name === dbm.team1?.name && cm.teamInfo[1]?.name === dbm.team2?.name) ||
        (cm.teamInfo[0]?.name === dbm.team2?.name && cm.teamInfo[1]?.name === dbm.team1?.name)
      if (dateClose && teamMatch && cm.matchEnded) {
        pairs.push({ dbMatch: dbm, cricMatchId: cm.id, cricMatchName: cm.name })
        break
      }
    }
  }
  console.log(`  ✓ Matched ${pairs.length} CricAPI matches to DB matches`)
  console.log("")

  const toProcess = LIMIT ? pairs.slice(0, LIMIT) : pairs

  if (DRY_RUN) {
    for (const p of toProcess) {
      console.log(`  [DRY] "${p.cricMatchName.slice(0, 50)}" → match ${p.dbMatch.id.slice(-8)}`)
    }
    return
  }

  // Step 4: Fetch all scorecards FIRST (HTTP phase), store in memory
  console.log("→ Fetching scorecards from CricAPI…")
  const scorecardData: { pair: MatchPair; sc: CricScorecardResponse | null }[] = []
  for (const pair of toProcess) {
    try {
      const url = `${API_BASE}/match_scorecard?apikey=${API_KEY}&id=${pair.cricMatchId}`
      const data = await fetchJSON(url)
      if (data.status === "success" && data.data) {
        scorecardData.push({ pair, sc: data.data as CricScorecardResponse })
        console.log(`  ✓ ${pair.cricMatchName.slice(0, 50)}`)
      } else {
        console.log(`  ✗ No scorecard: ${pair.cricMatchName.slice(0, 50)}`)
      }
    } catch (e: any) {
      console.log(`  ✗ Error: ${pair.cricMatchName.slice(0, 40)} — ${e.message?.slice(0, 50)}`)
    }
    // Small delay to avoid rate limiting (free tier = 100 req/day)
    await new Promise((r) => setTimeout(r, 500))
  }
  console.log(`  ✓ Fetched ${scorecardData.length} scorecards`)

  // Step 5: DB writes (no HTTP gaps — Prisma stays warm)
  console.log("")
  console.log("→ Saving to DB…")
  let updated = 0
  let playersCreated = 0
  for (const { pair, sc } of scorecardData) {
    if (!sc?.scorecard) continue

    // Get team info for the scorecard converter
    const team1 = await db.team.findUnique({ where: { id: pair.dbMatch.team1Id }, select: { name: true, shortName: true } })
    const team2 = await db.team.findUnique({ where: { id: pair.dbMatch.team2Id }, select: { name: true, shortName: true } })

    // Convert CricAPI format → internal format expected by the frontend
    const internalScorecard = convertScorecard(
      sc.scorecard,
      pair.dbMatch.team1Id,
      pair.dbMatch.team2Id,
      team1?.name || "",
      team2?.name || "",
      team1?.shortName || "",
      team2?.shortName || "",
    )
    const scorecardJson = JSON.stringify(internalScorecard)

    // Update the match's scorecard
    await db.match.update({
      where: { id: pair.dbMatch.id },
      data: { scorecard: scorecardJson },
    })
    updated++

    // Extract players from the scorecard and create Player rows
    const teamIds = [pair.dbMatch.team1Id, pair.dbMatch.team2Id]
    for (let i = 0; i < internalScorecard.innings.length; i++) {
      const inning = internalScorecard.innings[i]
      const teamId = inning.teamId || teamIds[i % 2]
      if (!teamId) continue

      // Create players from batting lines (internal format: name is a string)
      for (const batter of inning.batting ?? []) {
        const name = batter.name
        if (!name) continue
        const exists = await db.player.findFirst({ where: { name, teamId } })
        if (!exists) {
          await db.player.create({
            data: { name, teamId, role: "Batsman", battingStyle: "Right-hand bat" },
          })
          playersCreated++
        }
      }
      // Create players from bowling lines (internal format: name is a string)
      for (const bowler of inning.bowling ?? []) {
        const name = bowler.name
        if (!name) continue
        const exists = await db.player.findFirst({ where: { name, teamId } })
        if (!exists) {
          await db.player.create({
            data: { name, teamId, role: "Bowler", battingStyle: "Right-hand bat" },
          })
          playersCreated++
        }
      }
    }
  }

  console.log("")
  console.log(`✓ Updated ${updated} matches with scorecards`)
  console.log(`✓ Created ${playersCreated} new players`)

  const stillMissing = await db.match.count({ where: { status: "completed", scorecard: "" } })
  console.log(`Matches still missing scorecards: ${stillMissing}`)
}

main().catch((e) => {
  console.error("✗ Fatal error:", e)
  process.exit(1)
})
