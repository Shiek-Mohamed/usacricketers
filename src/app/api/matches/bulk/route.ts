import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { cacheDelPrefix } from "@/lib/cache"

/**
 * POST /api/matches/bulk — site-admin only. Bulk-create matches from a
 * parsed CSV/TSV paste.
 *
 * Body:
 *   {
 *     matches: Array<{
 *       team1Name: string,     // team short name or full name (looked up)
 *       team2Name: string,
 *       format?: string,       // Test, ODI, T20I, T10 (default: "T20I")
 *       matchNo?: string,      // e.g. "1st Match" (auto-generated if omitted)
 *       venue?: string,
 *       city?: string,
 *       startDate: string,     // ISO string or "YYYY-MM-DD HH:mm"
 *       seriesId?: string,     // optional series link
 *     }>
 *   }
 *
 * Team names are looked up by short name (case-insensitive). If a team
 * isn't found, that row is skipped and reported back in `skippedRows`.
 */
export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { matches } = body as {
    matches?: Array<Record<string, unknown>>
    seriesId?: string
  }
  const seriesId = body.seriesId || null

  if (!Array.isArray(matches) || matches.length === 0) {
    return NextResponse.json(
      { error: "No matches provided" },
      { status: 400 }
    )
  }

  // Pre-fetch all teams for name lookup (case-insensitive by short name).
  const allTeams = await db.team.findMany({ select: { id: true, name: true, shortName: true } })
  const teamLookup = new Map<string, string>() // lowercased name → id
  for (const t of allTeams) {
    teamLookup.set(t.shortName.toLowerCase(), t.id)
    teamLookup.set(t.name.toLowerCase(), t.id)
  }

  const created: unknown[] = []
  const skippedRows: string[] = []

  for (let i = 0; i < matches.length; i++) {
    const row = matches[i]
    if (!row || typeof row !== "object") continue

    const team1Name = String(row.team1Name ?? row.team1 ?? "").trim()
    const team2Name = String(row.team2Name ?? row.team2 ?? "").trim()
    if (!team1Name || !team2Name) {
      skippedRows.push(`Row ${i + 1}: missing team names`)
      continue
    }

    const team1Id = teamLookup.get(team1Name.toLowerCase())
    const team2Id = teamLookup.get(team2Name.toLowerCase())
    if (!team1Id || !team2Id) {
      skippedRows.push(`Row ${i + 1}: team "${team1Name}" or "${team2Name}" not found`)
      continue
    }
    if (team1Id === team2Id) {
      skippedRows.push(`Row ${i + 1}: both teams are the same (${team1Name})`)
      continue
    }

    const format = String(row.format ?? "T20I").trim()
    const matchNo = String(row.matchNo ?? `${i + 1}${ordinal(i + 1)} Match`)
    const venue = String(row.venue ?? "TBD").trim()
    const city = String(row.city ?? "").trim()
    const startDateStr = String(row.startDate ?? "").trim()

    let startDate: Date
    try {
      startDate = startDateStr ? new Date(startDateStr) : new Date()
      if (isNaN(startDate.getTime())) startDate = new Date()
    } catch {
      startDate = new Date()
    }

    try {
      const match = await db.match.create({
        data: {
          seriesId: seriesId || null,
          team1Id,
          team2Id,
          format,
          matchNo,
          status: "upcoming",
          venue,
          city,
          startDate,
        },
        include: { team1: true, team2: true, series: true },
      })
      created.push(serializeMatch(match))
    } catch (e) {
      skippedRows.push(`Row ${i + 1}: DB error — ${String(e).slice(0, 100)}`)
    }
  }

  cacheDelPrefix("matches:list")
  return NextResponse.json({
    created: created.length,
    skipped: skippedRows.length,
    skippedRows,
    matches: created,
  })
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
