import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeArticle, serializeTeam, serializeSeries, serializeVideo } from "@/lib/serialize"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** GET /api/search?q=... — searches articles, players, teams, series, videos. */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const q = new URL(req.url).searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ articles: [], players: [], teams: [], series: [], videos: [] })
  }

  const [articles, players, teams, series, videos] = await Promise.all([
    db.article.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q } },
          { excerpt: { contains: q } },
          { tags: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { publishedAt: "desc" },
    }),
    db.player.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { role: { contains: q } },
        ],
      },
      take: 5,
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
      take: 5,
    }),
    db.series.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { shortName: { contains: q } },
        ],
      },
      take: 5,
      include: { tournamentTeams: { include: { team: true } } },
    }),
    db.video.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { publishedAt: "desc" },
    }),
  ])

  return NextResponse.json({
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
    videos: videos.map(serializeVideo),
  })
}
