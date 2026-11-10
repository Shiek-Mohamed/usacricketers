import type { MetadataRoute } from "next"
import { db } from "@/lib/db"
import { headers } from "next/headers"

/**
 * /sitemap.xml — auto-generated from published articles + matches + teams +
 * players + series + galleries.
 *
 * Uses SEO-friendly SSR URLs:
 *   • /news/[slug]     — articles
 *   • /matches/[id]    — matches
 *   • /teams/[id]      — teams
 *   • /players/[id]    — players
 *
 * Force-dynamic so it always queries the DB at runtime (ISR caching would
 * bake in build-time results when the DB isn't available).
 */

// Resolve the base URL at runtime — try the request's host first (always
// correct), then env vars, then the known production URL.
// Always use https — the site is served over HTTPS (Fly terminates TLS),
// and the x-forwarded-proto header may be "http" because Caddy receives
// plain HTTP from Fly's edge proxy.
async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host")
    if (host) {
      // Local dev uses http, production always uses https
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1")
      return `${isLocal ? "http" : "https"}://${host}`
    }
  } catch {}
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://usacricketers.fly.dev"
  )
}

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getBaseUrl()
  const now = new Date()

  // Static pages — use clean paths where available, ?view=X for SPA-only pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "hourly", priority: 1.0 },
    { url: `${baseUrl}/?view=matches`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/?view=teams`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=players`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=series`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=schedule`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/?view=photos`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/?view=videos`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/?view=interviews`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/?view=stats`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ]

  // Dynamic pages from the DB — use SEO-friendly SSR URLs.
  let articlePages: MetadataRoute.Sitemap = []
  let matchPages: MetadataRoute.Sitemap = []
  let playerPages: MetadataRoute.Sitemap = []
  let teamPages: MetadataRoute.Sitemap = []
  let seriesPages: MetadataRoute.Sitemap = []
  try {
    const [articles, matches, players, teams, series] = await Promise.all([
      db.article.findMany({
        where: { published: true },
        select: { id: true, slug: true, updatedAt: true },
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
    articlePages = articles
      .filter((a) => a.slug) // only include articles with a slug
      .map((a) => ({
        url: `${baseUrl}/news/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      }))
    matchPages = matches.map((m) => ({
      url: `${baseUrl}/matches/${m.id}`,
      lastModified: m.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    }))
    playerPages = players.map((p) => ({
      url: `${baseUrl}/players/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }))
    teamPages = teams.map((t) => ({
      url: `${baseUrl}/teams/${t.id}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
    seriesPages = series.map((s) => ({
      url: `${baseUrl}/?view=series-detail&id=${s.id}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
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
