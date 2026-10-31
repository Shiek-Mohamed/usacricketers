import type { MetadataRoute } from "next"
import { db } from "@/lib/db"

/**
 * /sitemap.xml — auto-generated from published articles + matches + teams +
 * players + series + galleries. Regenerated on each request (up to 1 hour
 * cache via the `revalidate` export below).
 *
 * Includes:
 *   • Static pages (home, matches, news, teams, players, etc.)
 *   • Individual articles (/article?id=X)
 *   • Individual matches (/match?id=X)
 *   • Individual players (/player?id=X)
 *   • Individual teams (/team?id=X)
 *   • Individual series (/series?id=X)
 */
export const revalidate = 3600 // 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${baseUrl}/?view=matches`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/?view=news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/?view=teams`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=players`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=series`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=schedule`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/?view=photos`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/?view=videos`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/?view=interviews`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=stats`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ]

  // Dynamic pages from the DB. Wrapped in try/catch because the sitemap is
  // evaluated at BUILD time (ISR initial generation) where the database may
  // not be reachable (e.g. the Docker build container has no SQLite file at
  // the configured path). At runtime the queries succeed and the sitemap is
  // revalidated hourly.
  let articlePages: MetadataRoute.Sitemap = []
  let matchPages: MetadataRoute.Sitemap = []
  let playerPages: MetadataRoute.Sitemap = []
  let teamPages: MetadataRoute.Sitemap = []
  let seriesPages: MetadataRoute.Sitemap = []
  try {
    const [articles, matches, players, teams, series] = await Promise.all([
      db.article.findMany({
        where: { published: true },
        select: { id: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 500,
      }),
      db.match.findMany({
        select: { id: true, updatedAt: true },
        orderBy: { startDate: "desc" },
        take: 200,
      }),
      db.player.findMany({
        select: { id: true, updatedAt: true },
        take: 500,
      }),
      db.team.findMany({
        select: { id: true, updatedAt: true },
        take: 100,
      }),
      db.series.findMany({
        select: { id: true, updatedAt: true },
        take: 100,
      }),
    ])
    articlePages = articles.map((a) => ({
      url: `${baseUrl}/?view=article-detail&id=${a.id}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly",
      priority: 0.8,
    }))
    matchPages = matches.map((m) => ({
      url: `${baseUrl}/?view=match-detail&id=${m.id}`,
      lastModified: m.updatedAt,
      changeFrequency: "daily",
      priority: 0.9,
    }))
    playerPages = players.map((p) => ({
      url: `${baseUrl}/?view=player-detail&id=${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }))
    teamPages = teams.map((t) => ({
      url: `${baseUrl}/?view=team-detail&id=${t.id}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }))
    seriesPages = series.map((s) => ({
      url: `${baseUrl}/?view=series-detail&id=${s.id}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }))
  } catch {
    // DB unavailable (build-time / no volume) — return static pages only.
  }

  return [
    ...staticPages,
    ...articlePages,
    ...matchPages,
    ...playerPages,
    ...teamPages,
    ...seriesPages,
  ]
}
