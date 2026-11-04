import { notFound } from "next/navigation"
import { getLeagueHomepageData } from "@/lib/league-data"
import { LeagueHomepage } from "@/components/league/league-homepage"

// Reserved slugs that should NOT be treated as league lookups.
// These either match existing routes (Next.js handles those first) or
// are system paths that should 404 rather than render a league page.
const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "uploads",
  "_next",
  "league",
  "sitemap",
  "robots",
  "favicon",
  "score",
])

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (RESERVED_SLUGS.has(slug)) return {}
  // Wrap in try/catch — the Series table has a known Prisma 6.x DateTime
  // bug (integer timestamps) that makes findUnique throw instead of
  // returning null. A throw here would trigger the error boundary instead
  // of the 404 page. Catching → returning empty metadata lets the page
  // component call notFound() properly.
  let data: Awaited<ReturnType<typeof getLeagueHomepageData>> = null
  try {
    data = await getLeagueHomepageData(slug)
  } catch {
    return {}
  }
  if (!data) return {}
  return {
    title: `${data.league.name} — League Hub | USACricketers`,
    description: `Official hub for ${data.league.name}: fixtures, results, standings, and player statistics for the ${data.league.season} season.`,
  }
}

/**
 * Root-level catch-all route: /<slug>
 *
 * Looks up a Series (league) by its URL slug. If found, renders the League
 * Public Page. If not found (or reserved), returns 404.
 *
 * This matches the CricClubs URL pattern (cricclubs.com/LeagueName)
 * rather than a prefixed path (/league/LeagueName).
 *
 * Backwards compat: /league/<slug> still works (redirects here).
 *
 * NOTE: The data fetch is wrapped in try/catch because the Series table
 * has a known Prisma 6.x DateTime bug (integer timestamps instead of ISO
 * strings) that makes findUnique throw. Without the catch, a non-existent
 * slug would trigger the error boundary (500) instead of the 404 page.
 */
export default async function RootSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Reserved system paths → 404 (don't treat as league slugs)
  if (RESERVED_SLUGS.has(slug)) {
    notFound()
  }

  // Catch Prisma errors → notFound() so the branded 404 page renders
  // instead of the error boundary.
  let data: Awaited<ReturnType<typeof getLeagueHomepageData>> = null
  try {
    data = await getLeagueHomepageData(slug)
  } catch (err) {
    console.warn(`[/${slug}] league lookup threw (likely DateTime bug), serving 404:`, err)
    notFound()
  }
  if (!data) {
    notFound()
  }

  return (
    <LeagueHomepage
      data={data}
      leagueName={data.league.name.toUpperCase()}
      leagueShortName={
        data.league.format ? `${data.league.format} LEAGUE` : "CRICKET LEAGUE"
      }
      leagueInitials={data.league.shortName.slice(0, 2).toUpperCase()}
      season={data.league.season}
    />
  )
}
