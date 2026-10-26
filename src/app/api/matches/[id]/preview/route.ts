import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { parseBattingStats, parseBowlingStats } from "@/lib/types"
import { cacheDelPrefix } from "@/lib/cache"

/**
 * POST /api/matches/[id]/preview — site-admin only.
 * Generates a match-preview article draft from the match data:
 *   - Team info, head-to-head (from prior matches between the same teams)
 *   - Venue + date
 *   - Key players (top run-scorers + wicket-takers from each team's roster)
 *   - Auto-creates the article as a DRAFT (published: false) linked to the
 *     series, with the match's tags (team short names, format, match no)
 *
 * Returns the created article JSON.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const match = await db.match.findUnique({
    where: { id },
    include: {
      team1: { include: { players: true } },
      team2: { include: { players: true } },
      series: true,
    },
  })

  if (!match) {
    return NextResponse.json({ error: "match not found" }, { status: 404 })
  }

  // Head-to-head: count prior completed matches between the same 2 teams.
  const h2hMatches = await db.match.findMany({
    where: {
      status: "completed",
      OR: [
        { team1Id: match.team1Id, team2Id: match.team2Id },
        { team1Id: match.team2Id, team2Id: match.team1Id },
      ],
    },
    select: { result: true },
  })

  let t1Wins = 0, t2Wins = 0, ties = 0
  for (const m of h2hMatches) {
    const result = (m.result || "").toLowerCase()
    if (result.includes(match.team1?.name?.toLowerCase() || "___") ||
        result.includes(match.team1?.shortName?.toLowerCase() || "___")) t1Wins++
    else if (result.includes(match.team2?.name?.toLowerCase() || "___") ||
             result.includes(match.team2?.shortName?.toLowerCase() || "___")) t2Wins++
    else if (result.includes("tied") || result.includes("draw")) ties++
  }

  // Key players: top 3 run-scorers + top 2 wicket-takers per team.
  const topBatsmen = (players: any[], n: number) =>
    [...players]
      .map((p) => ({ name: p.name, role: p.role, runs: parseBattingStats(p.battingStats).runs }))
      .sort((a, b) => b.runs - a.runs)
      .filter((p) => p.runs > 0)
      .slice(0, n)

  const topBowlers = (players: any[], n: number) =>
    [...players]
      .map((p) => {
        const bowl = parseBowlingStats(p.bowlingStats)
        return { name: p.name, role: p.role, wickets: bowl?.wickets ?? 0 }
      })
      .sort((a, b) => b.wickets - a.wickets)
      .filter((p) => p.wickets > 0)
      .slice(0, n)

  const t1Batsmen = topBatsmen(match.team1?.players ?? [], 3)
  const t2Batsmen = topBatsmen(match.team2?.players ?? [], 3)
  const t1Bowlers = topBowlers(match.team1?.players ?? [], 2)
  const t2Bowlers = topBowlers(match.team2?.players ?? [], 2)

  // Build the article content as markdown.
  const t1Name = match.team1?.name ?? "Team 1"
  const t2Name = match.team2?.name ?? "Team 2"
  const t1Short = match.team1?.shortName ?? "T1"
  const t2Short = match.team2?.shortName ?? "T2"
  const matchDate = match.startDate.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })

  const content = `# ${t1Short} vs ${t2Short} — ${match.format} ${match.matchNo}

**${matchDate}** at **${match.venue || "TBD"}${match.city ? `, ${match.city}` : ""}**

${match.series ? `*${match.series.name} (${match.series.season})*` : ""}

---

## Match Preview

${t1Name} take on ${t2Name} in the ${match.matchNo} of the ${match.series?.name ?? "series"}. ${match.format === "Test" ? "This traditional format will test both teams' endurance and skill over up to 5 days of play." : match.format === "ODI" ? "The 50-over format demands a balance of patience and aggression from both sides." : "The fast-paced T20 format promises excitement and big hitting."}

## Head-to-Head

| | Played | ${t1Short} Won | ${t2Short} Won | Tied/NR |
|---|---|---|---|---|
| **All-time** | ${h2hMatches.length} | ${t1Wins} | ${t2Wins} | ${ties} |

${h2hMatches.length > 0
  ? `${t1Short} have won ${t1Wins} of the ${h2hMatches.length} previous meetings, while ${t2Short} have won ${t2Wins}. ${ties > 0 ? `${ties} matches ended without a result.` : ""}`
  : "This will be the first meeting between the two sides."}

## Key Players — ${t1Short}

${t1Batsmen.length > 0
  ? `**Top Batsmen:**\n${t1Batsmen.map((p, i) => `${i + 1}. **${p.name}** — ${p.runs} career runs (${p.role})`).join("\n")}`
  : "Player data not available."}

${t1Bowlers.length > 0
  ? `**Top Bowlers:**\n${t1Bowlers.map((p, i) => `${i + 1}. **${p.name}** — ${p.wickets} career wickets`).join("\n")}`
  : ""}

## Key Players — ${t2Short}

${t2Batsmen.length > 0
  ? `**Top Batsmen:**\n${t2Batsmen.map((p, i) => `${i + 1}. **${p.name}** — ${p.runs} career runs (${p.role})`).join("\n")}`
  : "Player data not available."}

${t2Bowlers.length > 0
  ? `**Top Bowlers:**\n${t2Bowlers.map((p, i) => `${i + 1}. **${p.name}** — ${p.wickets} career wickets`).join("\n")}`
  : ""}

## Venue

${match.venue || "TBD"}${match.city ? `, ${match.city}` : ""}

## Match Officials

${match.umpires ? `**Umpires:** ${match.umpires}` : "TBD"}
${match.tvUmpire ? `**TV Umpire:** ${match.tvUmpire}` : ""}
${match.referee ? `**Match Referee:** ${match.referee}` : ""}

---

*This preview was auto-generated from match data. Edit it before publishing.*`

  // Create the article as a draft.
  const article = await db.article.create({
    data: {
      title: `${t1Short} vs ${t2Short} — ${match.format} ${match.matchNo} Preview`,
      slug: `${t1Short.toLowerCase()}-vs-${t2Short.toLowerCase()}-${match.matchNo.toLowerCase().replace(/\s+/g, "-")}-preview`,
      excerpt: `${t1Name} face ${t2Name} in the ${match.matchNo} on ${matchDate} at ${match.venue || "TBD"}. Read our match preview.`,
      content,
      category: JSON.stringify(["preview", match.format.toLowerCase()]),
      author: admin.name,
      tags: `${t1Short}, ${t2Short}, ${match.format}, ${match.matchNo}, preview`,
      featured: false,
      published: false, // draft — admin reviews before publishing
      publishedAt: new Date().toISOString(),
      imageUrl: "",
      imageCaption: "",
    },
  })

  cacheDelPrefix("articles:list")
  return NextResponse.json({
    id: article.id,
    title: article.title,
    slug: article.slug,
    message: "Preview article generated as a draft — review and publish when ready.",
  }, { status: 201 })
}
