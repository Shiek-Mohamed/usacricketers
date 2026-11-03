import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { db } from "@/lib/db"
import { serializePlayer } from "@/lib/serialize"
import type { Prisma } from "@prisma/client"
import type { Player } from "@/lib/types"
import { PlayerPageContent } from "./PlayerPageContent"

// Always render fresh — player stats + bio can be edited at any time.
export const dynamic = "force-dynamic"

/**
 * Fetch a player by ID with a defensive raw-SQL fallback.
 *
 * Some historical rows in the SQLite DB have `createdAt` / `updatedAt`
 * stored as integer Unix-ms timestamps rather than ISO strings. When
 * Prisma's typed `findUnique` reads these it can throw (the DateTime
 * client expects a Date/ISO string, not a number). The fallback re-runs
 * the query as raw SQL and coerces numeric timestamps back into Date
 * objects so `serializePlayer` can safely call `.toISOString()` on them.
 */
async function fetchPlayerById(id: string) {
  try {
    const player = await db.player.findUnique({
      where: { id },
      include: { team: true },
    })
    return player
  } catch (err) {
    console.warn("[players/[id]] findUnique failed, trying raw SQL:", err)
    try {
      const rows = (await db.$queryRawUnsafe<
        Array<{
          id: string
          name: string
          teamId: string
          role: string
          isCaptain: number | boolean
          isKeeper: number | boolean
          battingStyle: string
          bowlingStyle: string
          battingStats: string
          bowlingStats: string
          bio: string
          imageUrl: string
          createdAt: Date | number | string
          updatedAt: Date | number | string
        }>
      >)(`SELECT * FROM "Player" WHERE id = ? LIMIT 1`, id)

      const row = rows[0]
      if (!row) return null

      const toDate = (v: Date | number | string): Date =>
        v instanceof Date ? v : new Date(typeof v === "number" ? v : Date.parse(v))

      const normalized = {
        ...row,
        isCaptain: !!row.isCaptain,
        isKeeper: !!row.isKeeper,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      }

      const team = await db.team
        .findUnique({ where: { id: row.teamId } })
        .catch(() => null)

      return {
        ...normalized,
        team,
      } as Prisma.PlayerGetPayload<{ include: { team: true } }>
    } catch (rawErr) {
      console.error("[players/[id]] raw SQL fallback failed:", rawErr)
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
  const player = await fetchPlayerById(id)
  if (!player) {
    return { title: "Player not found — USACricketers" }
  }
  const serialized = serializePlayer(player)
  const title = `${serialized.name} — Player Profile — USACricketers`
  const description =
    serialized.bio?.trim() ||
    `${serialized.role} · ${serialized.team?.name ?? "Free Agent"} · ${serialized.battingStyle}${serialized.bowlingStyle ? ` · ${serialized.bowlingStyle}` : ""}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/players/${id}`,
      images: serialized.imageUrl ? [serialized.imageUrl] : [],
    },
    alternates: { canonical: `/players/${id}` },
    twitter: {
      card: serialized.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: serialized.imageUrl ? [serialized.imageUrl] : [],
    },
  }
}

/**
 * Pre-render the most recent player IDs at build time so search engines see
 * the content with zero server roundtrip. Failures are swallowed — at
 * build time the SQLite file may not exist (Docker build container).
 */
export async function generateStaticParams() {
  try {
    const players = await db.player.findMany({
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })
    return players.map((p) => ({ id: p.id }))
  } catch {
    return []
  }
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const player = await fetchPlayerById(id)
  if (!player) notFound()

  const serialized = serializePlayer(player)

  // Teammates — same team, excluding the current player. Best-effort;
  // may fail if the DB has DateTime-bug rows.
  let teammateRows: Array<Prisma.PlayerGetPayload<{ include: { team: true } }>> = []
  try {
    const rows = await db.player.findMany({
      where: { teamId: player.teamId, id: { not: id } },
      include: { team: true },
      take: 5,
    })
    teammateRows = rows
  } catch (err) {
    console.warn("[players/[id]] teammates findMany failed:", err)
  }

  const teammates: Player[] = teammateRows.map((p) => serializePlayer(p))

  // Person JSON-LD structured data — rendered server-side so search
  // engines see it in the initial HTML response.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: serialized.name,
    jobTitle: serialized.role,
    image: serialized.imageUrl || undefined,
    description: serialized.bio || undefined,
    affiliation: serialized.team
      ? {
          "@type": "SportsTeam",
          name: serialized.team.name,
        }
      : undefined,
    url: `/players/${id}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PlayerPageContent player={serialized} teammates={teammates} />
    </>
  )
}
