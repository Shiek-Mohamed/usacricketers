import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"
import type { Prisma } from "@prisma/client"
import type { Match } from "@/lib/types"
import { MatchPageContent } from "./MatchPageContent"

// Always render fresh — match scores + live state change constantly.
export const dynamic = "force-dynamic"

/**
 * Fetch a match by ID with a defensive raw-SQL fallback.
 *
 * Some historical rows in the SQLite DB have `startDate` / `createdAt` /
 * `updatedAt` stored as integer Unix-ms timestamps rather than ISO strings.
 * When Prisma's typed `findUnique` reads these it can throw (the DateTime
 * client expects a Date/ISO string, not a number). The fallback re-runs the
 * query as raw SQL and coerces numeric timestamps back into Date objects so
 * `serializeMatch` can safely call `.toISOString()` on them.
 */
async function fetchMatchById(id: string) {
  try {
    const match = await db.match.findUnique({
      where: { id },
      include: { team1: true, team2: true, series: true },
    })
    return match
  } catch (err) {
    console.warn("[matches/[id]] findUnique failed, trying raw SQL:", err)
    try {
      // Raw fetch — we get the Match row only (no relations). Relations
      // (team1, team2, series) are loaded separately below so the rest of
      // the serializer works unchanged.
      const rows = (await db.$queryRawUnsafe<
        Array<{
          id: string
          seriesId: string | null
          team1Id: string
          team2Id: string
          format: string
          matchNo: string
          status: string
          venue: string
          city: string
          startDate: Date | number | string
          result: string
          manOfMatch: string | null
          umpires: string
          tvUmpire: string
          referee: string
          scorecard: string
          createdAt: Date | number | string
          updatedAt: Date | number | string
        }>
      >)(`SELECT * FROM "Match" WHERE id = ? LIMIT 1`, id)

      const row = rows[0]
      if (!row) return null

      const toDate = (v: Date | number | string): Date =>
        v instanceof Date ? v : new Date(typeof v === "number" ? v : Date.parse(v))

      const normalized = {
        ...row,
        startDate: toDate(row.startDate),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      }

      // Load relations in parallel (each may also throw — best-effort).
      const [team1, team2, series] = await Promise.all([
        db.team.findUnique({ where: { id: row.team1Id } }).catch(() => null),
        db.team.findUnique({ where: { id: row.team2Id } }).catch(() => null),
        row.seriesId
          ? db.series.findUnique({ where: { id: row.seriesId } }).catch(() => null)
          : Promise.resolve(null),
      ])

      return {
        ...normalized,
        team1,
        team2,
        series,
      } as Prisma.MatchGetPayload<{
        include: { team1: true; team2: true; series: true }
      }>
    } catch (rawErr) {
      console.error("[matches/[id]] raw SQL fallback failed:", rawErr)
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
  const match = await fetchMatchById(id)
  if (!match) {
    return { title: "Match not found — USACricketers" }
  }
  const serialized = serializeMatch(match)
  const t1 = serialized.team1?.shortName ?? "Team 1"
  const t2 = serialized.team2?.shortName ?? "Team 2"
  const title = `${t1} vs ${t2} — Match Details — USACricketers`
  const description =
    serialized.result ||
    `${serialized.format} · ${serialized.matchNo} · ${serialized.venue || "Venue TBA"} · ${new Date(serialized.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/matches/${id}`,
    },
    alternates: { canonical: `/matches/${id}` },
    twitter: {
      card: "summary",
      title,
      description,
    },
  }
}

/**
 * Pre-render the most recent match IDs at build time so search engines see
 * the content with zero server roundtrip. Older matches are rendered
 * on-demand (and cached) by `dynamic = "force-dynamic"`.
 *
 * Failures are swallowed — at build time the SQLite file may not exist
 * (Docker build container), in which case we skip pre-rendering entirely.
 */
export async function generateStaticParams() {
  try {
    const matches = await db.match.findMany({
      select: { id: true },
      orderBy: { startDate: "desc" },
      take: 50,
    })
    return matches.map((m) => ({ id: m.id }))
  } catch {
    return []
  }
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const match = await fetchMatchById(id)
  if (!match) notFound()

  const serialized = serializeMatch(match)

  // Recent completed matches for the sidebar — best-effort, may fail.
  let recentRows: Array<Prisma.MatchGetPayload<{
    include: { team1: true; team2: true; series: true }
  }>> = []
  try {
    recentRows = await db.match.findMany({
      where: { status: "completed" },
      include: { team1: true, team2: true, series: true },
      orderBy: { startDate: "desc" },
      take: 5,
    })
  } catch (err) {
    console.warn("[matches/[id]] recent findMany failed:", err)
  }

  const recent: Match[] = recentRows
    .filter((m) => m.id !== id)
    .map((m) => serializeMatch(m))

  // SportsEvent JSON-LD structured data — rendered server-side so search
  // engines see it in the initial HTML response.
  const t1Name = serialized.team1?.name ?? "Team 1"
  const t2Name = serialized.team2?.name ?? "Team 2"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${t1Name} vs ${t2Name} — ${serialized.matchNo}`,
    sport: "Cricket",
    startDate: serialized.startDate,
    endDate: undefined,
    location: serialized.venue
      ? {
          "@type": "Place",
          name: serialized.venue,
          address: serialized.city || undefined,
        }
      : undefined,
    homeTeam: serialized.team1
      ? { "@type": "SportsTeam", name: serialized.team1.name }
      : undefined,
    awayTeam: serialized.team2
      ? { "@type": "SportsTeam", name: serialized.team2.name }
      : undefined,
    description: serialized.result || undefined,
    url: `/matches/${id}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MatchPageContent match={serialized} recent={recent} />
    </>
  )
}
