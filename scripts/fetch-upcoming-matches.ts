#!/usr/bin/env bun
/**
 * scripts/fetch-upcoming-matches.ts
 *
 * Fetches upcoming (future) fixtures from CricAPI's /v1/matches endpoint
 * and saves them with status="upcoming". The main scraper's /currentMatches
 * endpoint only returns live + recently-completed matches — this script
 * fills the Upcoming tab with future fixtures.
 *
 * Usage:
 *   bun run scripts/fetch-upcoming-matches.ts            # fetch + save
 *   bun run scripts/fetch-upcoming-matches.ts --dry-run  # preview without saving
 */

import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const API_KEY = process.env.CRICAPI_KEY
const API_BASE = "https://api.cricapi.com/v1"
const CRICAPI_IP_FALLBACK = "135.181.170.35"

if (!API_KEY) {
  console.error("✗ CRICAPI_KEY is not set")
  process.exit(1)
}

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url)
    if (res.ok) return res.json()
  } catch (err: any) {
    const code = err?.code || ""
    const msg = err?.message || ""
    if (!/ENOTFOUND|EAI_AGAIN|ConnectionRefused|Could not resolve|Unable to connect/i.test(code + " " + msg)) throw err
  }
  const u = new URL(url)
  const pinnedUrl = url.replace(`https://${u.hostname}`, `https://${CRICAPI_IP_FALLBACK}`)
  const res = await fetch(pinnedUrl, {
    headers: { Host: u.hostname },
    // @ts-ignore
    tls: { rejectUnauthorized: false, servername: u.hostname },
  })
  return res.json()
}

function extractMatchNo(name: string): string {
  const m1 = name.match(/(\d+(?:st|nd|rd|th)\s+(?:Match|ODI|T20I|T20|Test|Unofficial\s+ODI|Unofficial\s+Test))/i)
  if (m1) return m1[1]
  const m2 = name.match(/\b(Final|Semi-Final|Quarter-Final|Eliminator)\b/i)
  if (m2) return m2[1]
  const parts = name.split(",")
  if (parts.length >= 2) {
    const seg = parts[1].trim()
    return seg.length > 30 ? seg.slice(0, 29) + "…" : seg
  }
  return "Match"
}

async function main() {
  console.log(" Upcoming matches fetcher")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN" : "SAVE"}`)
  console.log("")

  console.log("→ Fetching all matches from CricAPI /v1/matches…")
  const data = await fetchJSON(`${API_BASE}/matches?apikey=${API_KEY}&offset=0`)
  if (data.status !== "success") {
    console.error("✗ API error:", data)
    process.exit(1)
  }

  const now = new Date()
  const all = data.data ?? []
  const upcoming = all.filter((m: any) =>
    m.matchStarted === false &&
    m.matchEnded === false &&
    m.dateTimeGMT &&
    new Date(m.dateTimeGMT) > now
  )
  console.log(`  ✓ ${all.length} total matches, ${upcoming.length} upcoming`)

  if (DRY_RUN) {
    for (const m of upcoming.slice(0, 10)) {
      console.log(`  [DRY] ${new Date(m.dateTimeGMT).toISOString().slice(0,10)} ${m.name?.slice(0,50)}`)
    }
    if (upcoming.length > 10) console.log(`  … and ${upcoming.length - 10} more`)
    return
  }

  let added = 0
  let skipped = 0
  for (const m of upcoming) {
    if (!m.teamInfo || m.teamInfo.length < 2) { skipped++; continue }
    const teamIds: string[] = []
    for (const t of m.teamInfo.slice(0, 2)) {
      let team = await db.team.findFirst({ where: { name: t.name } })
      if (!team) {
        team = await db.team.create({
          data: {
            name: t.name,
            shortName: t.shortname || t.name.slice(0, 3).toUpperCase(),
            country: t.name,
            primaryColor: "#1e3a8a",
            accentColor: "#f59e0b",
            logoUrl: t.imgUrl || "",
            description: "",
          },
        })
      }
      teamIds.push(team.id)
    }
    const startDate = new Date(m.dateTimeGMT)
    const existing = await db.match.findFirst({
      where: {
        team1Id: teamIds[0], team2Id: teamIds[1],
        startDate: {
          gt: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
          lt: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    })
    if (existing) { skipped++; continue }
    const formatMap: Record<string, string> = {
      test: "Test", odi: "ODI", t20: "T20I", t20i: "T20I", t10: "T10",
    }
    await db.match.create({
      data: {
        team1Id: teamIds[0], team2Id: teamIds[1],
        format: formatMap[(m.matchType || "").toLowerCase()] || "ODI",
        matchNo: extractMatchNo(m.name),
        status: "upcoming",
        venue: m.venue || "TBD",
        city: "",
        startDate,
        result: "",
        scorecard: "",
      },
    })
    added++
  }
  console.log(`\n✓ Added ${added} upcoming matches (skipped ${skipped} dupes/incomplete)`)

  const byStatus = await db.match.groupBy({ by: ["status"], _count: true })
  console.log(`\nFinal state:`)
  for (const s of byStatus) console.log(`  ${s.status}: ${s._count}`)
}

main().catch((e) => {
  console.error("✗ Fatal error:", e)
  process.exit(1)
})
