import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { db } from "@/lib/db"
import { serializeTeam, serializePlayer, serializeMatch } from "@/lib/serialize"
import type { Prisma } from "@prisma/client"
import type { Match, Player } from "@/lib/types"
import { TeamPageContent } from "./TeamPageContent"

// Always render fresh — team rosters + recent matches change constantly.
export const dynamic = "force-dynamic"

/**
 * Fetch a team by ID with a defensive raw-SQL fallback.
 *
 * Some historical rows in the SQLite DB have `createdAt` / `updatedAt`
 * stored as integer Unix-ms timestamps rather than ISO strings. When
 * Prisma's typed `findUnique` reads these it can throw (the DateTime
 * client expects a Date/ISO string, not a number). The fallback re-runs
 * the query as raw SQL and coerces numeric timestamps back into Date
 * objects so `serializeTeam` can safely call `.toISOString()` on them.
 */
async function fetchTeamById(id: string) {
  try {
    const team = await db.team.findUnique({ where: { id } })
    return team
  } catch (err) {
    console.warn("[teams/[id]] findUnique failed, trying raw SQL:", err)
    try {
      const rows = (await db.$queryRawUnsafe<
        Array<{
          id: string
          name: string
          shortName: string
          country: string
          primaryColor: string
          accentColor: string
          logoUrl: string | null
          description: string
          createdAt: Date | number | string
          updatedAt: Date | number | string
        }>
      >)(`SELECT * FROM "Team" WHERE id = ? LIMIT 1`, id)

      const row = rows[0]
      if (!row) return null

      const toDate = (v: Date | number | string): Date =>
        v instanceof Date ? v : new Date(typeof v === "number" ? v : Date.parse(v))

      return {
        ...row,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      } as Prisma.TeamGetPayload<Record<string, never>>
    } catch (rawErr) {
      console.error("[teams/[id]] raw SQL fallback failed:", rawErr)
      return null
    }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const team = await fetchTeamById(id)
  if (!team) {
    return { title: "Team not found — USACricketers" }
  }
  const serialized = serializeTeam(team)
  const title = `${serialized.name} — Team Profile — USACricketers`
  const description =
    serialized.description?.trim() ||
    `${serialized.name} (${serialized.shortName}) — ${serialized.country || "International"} cricket team`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/teams/${id}`,
      images: serialized.logoUrl ? [serialized.logoUrl] : [],
    },
    alternates: { canonical: `/teams/${id}` },
    twitter: {
      card: serialized.logoUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: serialized.logoUrl ? [serialized.logoUrl] : [],
    },
  }
}

/**
 * Pre-render all team IDs at build time. Failures are swallowed — at
 * build time the SQLite file may not exist (Docker build container).
 */
export async function generateStaticParams() {
  try {
    const teams = await db.team.findMany({
      select: { id: true },
      orderBy: { name: "asc" },
    })
    return teams.map((t) => ({ id: t.id }))
  } catch {
    return []
  }
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const team = await fetchTeamById(id)
  if (!team) notFound()

  const serializedTeam = serializeTeam(team)

  // Players in the team roster — best-effort.
  let playerRows: Array<Prisma.PlayerGetPayload<{ include: { team: true } }>> = []
  try {
    playerRows = await db.player.findMany({
      where: { teamId: id },
      include: { team: true },
      orderBy: { name: "asc" },
    })
  } catch (err) {
    console.warn("[teams/[id]] players findMany failed:", err)
  }
  const players: Player[] = playerRows.map((p) => serializePlayer(p))

  // Recent matches involving this team — best-effort.
  let matchRows: Array<Prisma.MatchGetPayload<{
    include: { team1: true; team2: true; series: true }
  }>> = []
  try {
    matchRows = await db.match.findMany({
      where: { OR: [{ team1Id: id }, { team2Id: id }] },
      include: { team1: true, team2: true, series: true },
      orderBy: { startDate: "desc" },
      take: 5,
    })
  } catch (err) {
    console.warn("[teams/[id]] matches findMany failed:", err)
  }
  const recentMatches: Match[] = matchRows.map((m) => serializeMatch(m))

  // SportsTeam JSON-LD structured data — rendered server-side so search
  // engines see it in the initial HTML response.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: serializedTeam.name,
    alternateName: serializedTeam.shortName,
    description: serializedTeam.description || undefined,
    image: serializedTeam.logoUrl || undefined,
    sport: "Cricket",
    url: `/teams/${id}`,
    member: players.map((p) => ({
      "@type": "Person",
      name: p.name,
      jobTitle: p.role,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TeamPageContent
        team={serializedTeam}
        players={players}
        recentMatches={recentMatches}
      />
    </>
  )
}
