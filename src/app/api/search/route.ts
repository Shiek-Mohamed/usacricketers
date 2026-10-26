import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeArticle, serializeTeam, serializeSeries, serializeVideo, serializeMatch } from "@/lib/serialize"
import { rateLimit } from "@/lib/rate-limit"

/** GET /api/search?q=... — searches articles, players, teams, series, matches, videos.
 *  SQLite's LIKE is case-insensitive for ASCII by default — no `mode: "insensitive"`
 *  needed. Returns 10 results per entity type + a 30s CDN cache for repeated queries. */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const q = new URL(req.url).searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ query: q || "", articles: [], players: [], teams: [], series: [], matches: [], videos: [] })
  }

  const [articles, players, teams, series, matches, videos] = await Promise.all([
    db.article.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q } },
          { excerpt: { contains: q } },
          { tags: { contains: q } },
          { content: { contains: q } }, // search full article body too
          { author: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { publishedAt: "desc" },
    }),
    db.player.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { role: { contains: q } },
        ],
      },
      take: 10,
      include: { team: true },
    }),
    db.team.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { shortName: { contains: q } },
          { country: { contains: q } },
        ],
      },
      take: 10,
    }),
    db.series.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { shortName: { contains: q } },
        ],
      },
      take: 10,
      include: { tournamentTeams: { include: { team: true } } },
    }),
    db.match.findMany({
      where: {
        OR: [
          { matchNo: { contains: q } },
          { venue: { contains: q } },
          { city: { contains: q } },
          { result: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { startDate: "desc" },
      include: { team1: true, team2: true, series: true },
    }),
    db.video.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { publishedAt: "desc" },
    }),
  ])

  const res = NextResponse.json({
    query: q,
    total: articles.length + players.length + teams.length + series.length + matches.length + videos.length,
    articles: articles.map(serializeArticle),
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      teamId: p.teamId,
      teamShortName: p.team?.shortName ?? "",
      imageUrl: p.imageUrl,
    })),
    teams: teams.map(serializeTeam),
    series: series.map(serializeSeries),
    matches: matches.map(serializeMatch),
    videos: videos.map(serializeVideo),
  })
  // Short CDN cache for repeated queries — search is expensive.
  res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60")
  return res
}
