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
const NO_SCORECARD = args.includes("--no-scorecard")
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
  batsman?: string | { id?: string; name?: string; cricbuzz_id?: string }
  runs?: number
  balls?: number
  fours?: number
  sixes?: number
  out?: string
  striker?: boolean
}

interface CricScorecardBowler {
  bowler?: string | { id?: string; name?: string; cricbuzz_id?: string }
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

// The sandbox DNS sometimes fails to resolve api.cricapi.com (SERVFAIL from
// the default resolvers). Pin the IP we resolved via 8.8.8.8 as a fallback
// so the scraper keeps working when DNS is flaky. The Host header is sent
// normally so TLS SNI + the upstream vhost still match.
const CRICAPI_IP_FALLBACK = "135.181.170.35"

async function fetchJSON(url: string): Promise<any> {
  // First try: normal fetch (works when DNS is healthy)
  let firstErr: any = null
  try {
    const res = await fetch(url)
    if (res.ok) return res.json()
    const body = await res.text()
    throw new Error(`HTTP ${res.status} for ${url}\n${body.slice(0, 500)}`)
  } catch (err: any) {
    firstErr = err
    const code = err?.code || ""
    const msg = err?.message || ""
    // Only retry on DNS/connection errors — not on HTTP errors
    const isConnErr = /ENOTFOUND|EAI_AGAIN|ConnectionRefused|Could not resolve|Unable to connect/i.test(code + " " + msg)
    if (!isConnErr) throw err
    console.log(`  ⚠️  Connection failed (${code || msg.slice(0, 40)}), retrying with pinned IP…`)
  }

  // Second try: rewrite the URL to use the IP, override Host header for TLS
  const u = new URL(url)
  const pinnedUrl = url.replace(`https://${u.hostname}`, `https://${CRICAPI_IP_FALLBACK}`)
  try {
    const res = await fetch(pinnedUrl, {
      headers: { Host: u.hostname },
      // @ts-ignore — tls options for Bun's fetch
      tls: { rejectUnauthorized: false, servername: u.hostname },
    })
    if (res.ok) return res.json()
    const body = await res.text()
    throw new Error(`HTTP ${res.status} for ${url} (via pinned IP)\n${body.slice(0, 500)}`)
  } catch (err: any) {
    // Pinned IP also failed — re-throw the original error for clarity
    throw firstErr || err
  }
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

/** Extract a human-readable match label from the CricAPI match name.
 *  e.g. "India vs Australia, 3rd ODI, Series 2026" → "3rd ODI"
 *       "India vs Australia, Final, Series 2026" → "Final" */
function extractMatchNo(name: string): string {
  // Try "Nth Match" / "Nst Match" etc.
  const m1 = name.match(/(\d+(?:st|nd|rd|th)\s+(?:Match|ODI|T20I|T20|Test|Unofficial\s+ODI|Unofficial\s+Test))/i)
  if (m1) return m1[1]
  // Try Final / Semi-Final / Quarter-Final
  const m2 = name.match(/\b(Final|Semi-Final|Quarter-Final|Eliminator)\b/i)
  if (m2) return m2[1]
  // Fall back to the segment after the first comma
  const parts = name.split(",")
  if (parts.length >= 2) {
    const seg = parts[1].trim()
    // Keep it short — truncate to 30 chars
    return seg.length > 30 ? seg.slice(0, 29) + "…" : seg
  }
  return "Match"
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
    if (m.matchEnded && !NO_SCORECARD) {
      try {
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
              const batterName = typeof batter.batsman === "string"
                ? batter.batsman
                : batter.batsman?.name
              if (!batterName) continue
              try {
                const exists = await db.player.findFirst({
                  where: { name: batterName, teamId },
                })
                if (!exists) {
                  await db.player.create({
                    data: {
                      name: batterName,
                      teamId,
                      role: "Batsman",
                      battingStyle: "Right-hand bat",
                    },
                  })
                  playerCount++
                }
              } catch (e) {
                // Don't let a single player error abort the whole scrape
              }
            }
            for (const bowler of inning.bowling ?? []) {
              const bowlerName = typeof bowler.bowler === "string"
                ? bowler.bowler
                : bowler.bowler?.name
              if (!bowlerName) continue
              try {
                const exists = await db.player.findFirst({
                  where: { name: bowlerName, teamId },
                })
                if (!exists) {
                  await db.player.create({
                    data: {
                      name: bowlerName,
                      teamId,
                      role: "Bowler",
                      battingStyle: "Right-hand bat",
                    },
                  })
                  playerCount++
                }
              } catch (e) {
                // Don't let a single player error abort the whole scrape
              }
            }
          }
        }
      } catch (e) {
        // Scorecard fetch failed — continue without it (match still saves)
        console.log(`  ⚠️  Scorecard fetch failed for ${m.id}: ${(e as Error).message?.slice(0, 60)}`)
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

    // Check if match already exists — dedup by teams + start date (more
    // robust than matchNo, which is now a clean display label).
    const startDate = m.dateTimeGMT ? new Date(m.dateTimeGMT) : new Date()
    const cleanMatchNo = extractMatchNo(m.name)
    const existing = await db.match.findFirst({
      where: {
        team1Id: teamIds[0],
        team2Id: teamIds[1],
        startDate: { gt: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
                     lt: new Date(startDate.getTime() + 24 * 60 * 60 * 1000) },
      },
    })

    if (existing) {
      await db.match.update({
        where: { id: existing.id },
        data: {
          status,
          result: result || scoreSummary,
          scorecard: scorecardJson || existing.scorecard,
          venue: m.venue || existing.venue,
          // Update matchNo to the clean label if the existing one still has
          // the old cricapi- prefix.
          ...(existing.matchNo?.startsWith("cricapi-") ? { matchNo: cleanMatchNo } : {}),
        },
      })
    } else {
      await db.match.create({
        data: {
          team1Id: teamIds[0],
          team2Id: teamIds[1],
          format,
          matchNo: cleanMatchNo,
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
    console.error("  Full error:")
    console.error("  " + (e?.message || String(e)).split("\n").slice(0, 15).join("\n  "))
    if (e?.code) console.error("  Prisma error code:", e.code)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("✗ Fatal error:")
  console.error(e)
  process.exit(1)
})
