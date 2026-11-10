#!/usr/bin/env bun
/**
 * scripts/scrape-cricapi.ts
 *
 * Pulls live + recent international cricket matches from CricAPI
 * (https://cricapi.com) and (optionally) persists them to the local DB
 * via Prisma — populating Match / Team / Player rows so you can see how
 * the match / team / player pages render with real data.
 *
 * Usage:
 *   bun run scripts/scrape-cricapi.ts            # dry-run: fetch + print, no DB writes
 *   bun run scripts/scrape-cricapi.ts --save     # persist to DB
 *   bun run scripts/scrape-cricapi.ts --limit 3  # only process first 3 matches
 *   bun run scripts/scrape-cricapi.ts --verbose  # print full JSON for each match
 *
 * Requires CRICAPI_KEY in .env (free signup at https://cricapi.com).
 */

import { config } from "dotenv"
config() // load .env so process.env.CRICAPI_KEY is available

const API_KEY = process.env.CRICAPI_KEY
const API_BASE = "https://api.cricapi.com/v1"

if (!API_KEY) {
  console.error("✗ CRICAPI_KEY is not set. Add it to .env:")
  console.error("    CRICAPI_KEY=your-key-here")
  process.exit(1)
}

const args = process.argv.slice(2)
const SAVE = args.includes("--save")
const VERBOSE = args.includes("--verbose")
const limitIdx = args.indexOf("--limit")
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) || 0 : 0

/* ------------------------------ CricAPI types ----------------------------- */

interface CricTeamInfo {
  name: string
  shortname: string
  imgUrl?: string
}

interface CricScore {
  r: number
  w: number
  o: number
  inning: string
}

interface CricMatch {
  id: string
  name: string
  matchType: string
  status: string
  venue?: string
  date?: string
  dateTimeGMT?: string
  teams?: string[]
  teamInfo?: CricTeamInfo[]
  score?: CricScore[]
  series_id?: string
  matchStarted?: boolean
  matchEnded?: boolean
}

interface CricScorecardBatter {
  batsman?: string
  runs?: number
  balls?: number
  fours?: number
  sixes?: number
  out?: string
  striker?: boolean
}

interface CricScorecardBowler {
  bowler?: string
  overs?: string
  maidens?: number
  runs?: number
  wickets?: number
  economy?: number
}

interface CricScorecardInnings {
  inning?: string
  batting?: CricScorecardBatter[]
  bowling?: CricScorecardBowler[]
  extras?: { r?: number; w?: number; b?: number; lb?: number; nb?: number; p?: number }
  fow?: { batsman?: string; score?: string }[]
}

interface CricScorecardResponse {
  matchId?: string
  name?: string
  venue?: string
  date?: string
  status?: string
  teamInfo?: CricTeamInfo[]
  scorecard?: CricScorecardInnings[]
}

/* ------------------------------ HTTP helpers ------------------------------ */

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status} for ${url}\n${body.slice(0, 500)}`)
  }
  return res.json()
}

async function getCurrentMatches(): Promise<CricMatch[]> {
  const url = `${API_BASE}/currentMatches?apikey=${API_KEY}&offset=0`
  const data = await fetchJSON(url)
  if (data.status !== "success") {
    throw new Error(`CricAPI error: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return (data.data ?? []) as CricMatch[]
}

async function getScorecard(matchId: string): Promise<CricScorecardResponse | null> {
  const url = `${API_BASE}/match_scorecard?apikey=${API_KEY}&id=${matchId}`
  const data = await fetchJSON(url)
  if (data.status !== "success") return null
  return data.data as CricScorecardResponse
}

/* ------------------------------ Pretty print ------------------------------ */

function fmtScore(s?: CricScore): string {
  if (!s) return "—"
  return `${s.r}/${s.w} (${s.o} ov)`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

function printMatchSummary(m: CricMatch): void {
  console.log("")
  console.log(`  ${m.name}`)
  console.log(`  Format: ${(m.matchType || "?").toUpperCase()}  ·  ${m.status}`)
  if (m.venue) console.log(`  Venue:  ${m.venue}`)
  if (m.date) console.log(`  Date:   ${new Date(m.date).toLocaleDateString()}`)
  if (m.teamInfo && m.teamInfo.length) {
    const teams = m.teamInfo.map((t) => `${t.name} (${t.shortname})`).join("  vs  ")
    console.log(`  Teams:  ${teams}`)
  }
  if (m.score && m.score.length) {
    for (const s of m.score) {
      console.log(`    ${truncate(s.inning || "Innings", 30).padEnd(30)}  ${fmtScore(s)}`)
    }
  }
  if (VERBOSE) {
    console.log("  --- full JSON ---")
    console.log(JSON.stringify(m, null, 2).split("\n").slice(0, 50).join("\n"))
  }
}

/* ------------------------------ DB persistence ---------------------------- *
 *
 * NOTE: this section requires the DB to be reachable. The current schema
 * declares provider="postgresql" but .env has a file: URL — Prisma will
 * reject this until one of these is fixed:
 *   (a) change prisma/schema.prisma provider back to "sqlite" (fastest)
 *   (b) point DATABASE_URL at a real Postgres instance
 *
 * We import db lazily so dry-run mode works without Prisma being healthy.
 * ------------------------------------------------------------------------- */

async function persist(matches: CricMatch[]): Promise<void> {
  const { db } = await import("@/lib/db")

  let teamCount = 0
  let matchCount = 0
  let playerCount = 0

  // Cache teams by name within this run so we don't re-query each time.
  const teamCache = new Map<string, string>()

  async function ensureTeam(info: CricTeamInfo): Promise<string> {
    const cached = teamCache.get(info.name)
    if (cached) return cached

    let team = await db.team.findFirst({ where: { name: info.name } })
    if (!team) {
      team = await db.team.create({
        data: {
          name: info.name,
          shortName: info.shortname || info.name.slice(0, 3).toUpperCase(),
          country: info.name, // best-effort: full team name as "country"
          primaryColor: "#1e3a8a",
          accentColor: "#f59e0b",
          logoUrl: info.imgUrl || "",
          description: "",
        },
      })
      teamCount++
    }
    teamCache.set(info.name, team.id)
    return team.id
  }

  for (const m of matches) {
    if (!m.teamInfo || m.teamInfo.length < 2) continue

    const teamIds = await Promise.all(
      m.teamInfo.slice(0, 2).map((t) => ensureTeam(t))
    )

    // Fetch full scorecard if the match has ended — gives us batting/bowling
    // lines we can stash in Match.scorecard (JSON string).
    let scorecardJson = ""
    if (m.matchEnded) {
      const sc = await getScorecard(m.id)
      if (sc?.scorecard) {
        scorecardJson = JSON.stringify(sc.scorecard)

        // Pull player names out of the scorecard and create Player rows
        // (keyed by name within team — CricAPI free tier doesn't give us
        // reliable player IDs).
        for (let i = 0; i < (sc.scorecard.length || 0); i++) {
          const inning = sc.scorecard[i]
          const teamIdx = i % 2 // first innings = team1, second = team2 (rough)
          const teamId = teamIds[teamIdx]
          if (!teamId) continue
          for (const batter of inning.batting ?? []) {
            if (!batter.batsman) continue
            const exists = await db.player.findFirst({
              where: { name: batter.batsman, teamId },
            })
            if (!exists) {
              await db.player.create({
                data: {
                  name: batter.batsman,
                  teamId,
                  role: "Batsman",
                  battingStyle: "Right-hand bat",
                },
              })
              playerCount++
            }
          }
          for (const bowler of inning.bowling ?? []) {
            if (!bowler.bowler) continue
            const exists = await db.player.findFirst({
              where: { name: bowler.bowler, teamId },
            })
            if (!exists) {
              await db.player.create({
                data: {
                  name: bowler.bowler,
                  teamId,
                  role: "Bowler",
                  battingStyle: "Right-hand bat",
                },
              })
              playerCount++
            }
          }
        }
      }
    }

    // Map CricAPI status → our Match.status enum (upcoming|live|completed|abandoned)
    let status = "upcoming"
    if (m.matchEnded) status = "completed"
    else if (m.matchStarted) status = "live"
    if (/abandon|cancel|no result/i.test(m.status)) status = "abandoned"

    // Format → our Match.format enum (Test|ODI|T20I|...)
    const formatMap: Record<string, string> = {
      test: "Test",
      odi: "ODI",
      t20: "T20I",
      t20i: "T20I",
      t10: "T10",
    }
    const format = formatMap[(m.matchType || "").toLowerCase()] || "ODI"

    // Result string — CricAPI's status field usually has the result text
    // for completed matches (e.g. "Australia won by 4 wickets").
    const result = m.matchEnded ? m.status : ""

    // Build a result-ish string from the scores for the scorecard summary
    const scoreSummary = (m.score ?? [])
      .map((s) => `${s.inning}: ${fmtScore(s)}`)
      .join("  |  ")

    // Check if match already exists (by CricAPI id — store as matchNo for dedup)
    const existing = await db.match.findFirst({
      where: { matchNo: `cricapi-${m.id}` },
    })

    const startDate = m.dateTimeGMT ? new Date(m.dateTimeGMT) : new Date()

    if (existing) {
      await db.match.update({
        where: { id: existing.id },
        data: {
          status,
          result: result || scoreSummary,
          scorecard: scorecardJson || existing.scorecard,
          venue: m.venue || existing.venue,
        },
      })
    } else {
      await db.match.create({
        data: {
          team1Id: teamIds[0],
          team2Id: teamIds[1],
          format,
          matchNo: `cricapi-${m.id}`,
          status,
          venue: m.venue || "TBD",
          city: "",
          startDate,
          result: result || scoreSummary,
          scorecard: scorecardJson,
        },
      })
      matchCount++
    }
  }

  console.log("")
  console.log(`  ✓ Persisted:`)
  console.log(`    ${teamCount} new teams`)
  console.log(`    ${playerCount} new players`)
  console.log(`    ${matchCount} new matches`)
}

/* --------------------------------- Main ---------------------------------- */

async function main(): Promise<void> {
  console.log(" CricketData scrape — CricAPI.com")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode:    ${SAVE ? "SAVE (DB writes)" : "DRY-RUN (no DB writes)"}`)
  if (LIMIT) console.log(`  Limit:   first ${LIMIT} matches`)
  console.log("")

  console.log("→ Fetching current matches from CricAPI…")
  const matches = await getCurrentMatches()
  console.log(`  ✓ ${matches.length} matches returned`)

  const toProcess = LIMIT ? matches.slice(0, LIMIT) : matches

  console.log("")
  console.log(" Match summary")
  console.log("───────────────────────────────────────────")
  for (const m of toProcess) printMatchSummary(m)

  if (!SAVE) {
    console.log("")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(" Dry-run complete — no DB writes.")
    console.log(" To persist:  bun run scripts/scrape-cricapi.ts --save")
    return
  }

  console.log("")
  console.log("→ Persisting to DB via Prisma…")
  try {
    await persist(toProcess)
    console.log("")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(" Done. Open the site to see real data on the pages.")
  } catch (e: any) {
    console.error("")
    console.error("✗ DB error during persist:")
    console.error("  " + (e?.message || String(e)).split("\n").slice(0, 4).join("\n  "))
    console.error("")
    console.error("  This is most likely the prisma schema/env mismatch we")
    console.error("  discussed — schema.prisma has provider=\"postgresql\" but")
    console.error("  .env has DATABASE_URL=file:... (SQLite URL).")
    console.error("")
    console.error("  Fix (quickest): change provider back to \"sqlite\" in")
    console.error("  prisma/schema.prisma, then re-run this script with --save.")
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("✗ Fatal error:")
  console.error(e)
  process.exit(1)
})
