import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"
import {
  generateRoundRobin,
  generateKnockout,
  generateGroupKnockout,
  type FixtureTeam,
  type ScheduleFormat,
} from "@/lib/fixtures"

export const dynamic = "force-dynamic"

/**
 * POST /api/league-admin/schedule/generate
 *
 * Auto-generates a fixture list for a tournament (series) and bulk-creates
 * all matches in one transaction. Supports:
 *   - round-robin-single  (each team plays every other once)
 *   - round-robin-double  (home + away)
 *   - group-knockout      (groups → round-robin → knockout bracket)
 *   - knockout            (single elimination with byes)
 *
 * Body:
 *   seriesId: string
 *   format: "round-robin-single" | "round-robin-double" | "group-knockout" | "knockout"
 *   startDate: string (ISO date, e.g. "2026-11-15")
 *   intervalDays: number (days between matches, default 1)
 *   venue: string (default venue for all matches)
 *   matchFormat: string (e.g. "T20", "ODI" — default "T20")
 *   groupCount?: number (for group-knockout, default 2)
 *   qualifiersPerGroup?: number (for group-knockout, default 2)
 *   doubleRoundRobin?: boolean (deprecated — use format="round-robin-double")
 *
 * Uses raw SQL for match inserts (Prisma 6.x mishandles Date objects for
 * SQLite on some tables). Matches with "TBD" opponents (knockout placeholders
 * for qualifiers not yet determined) are skipped — they'll be created later.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { managedSeriesIds } = auth.ctx

  try {
    const body = await req.json()
    const seriesId = String(body.seriesId || "")
    if (!seriesId || !managedSeriesIds.includes(seriesId)) {
      return NextResponse.json(
        { error: "forbidden: not your league" },
        { status: 403 }
      )
    }

    const format = (body.format || "round-robin-single") as ScheduleFormat
    const startDateStr = String(body.startDate || "")
    if (!startDateStr) {
      return NextResponse.json(
        { error: "startDate is required" },
        { status: 400 }
      )
    }
    const startDate = new Date(startDateStr)
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "invalid startDate" },
        { status: 400 }
      )
    }

    const intervalDays = Math.max(0, Number(body.intervalDays) || 1)
    const venue = String(body.venue || "")
    const matchFormat = String(body.matchFormat || "T20")

    // Fetch the tournament's teams
    const tournamentTeams = await db.tournamentTeam.findMany({
      where: { seriesId },
      include: { team: true },
    })
    const teams: FixtureTeam[] = tournamentTeams.map((tt) => ({
      id: tt.team.id,
      name: tt.team.name,
    }))

    if (teams.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 teams to generate a schedule. Add teams to the tournament first." },
        { status: 400 }
      )
    }

    // Generate fixtures based on the format
    let fixtures
    if (format === "round-robin-single") {
      fixtures = generateRoundRobin(teams, false, startDate, intervalDays)
    } else if (format === "round-robin-double") {
      fixtures = generateRoundRobin(teams, true, startDate, intervalDays)
    } else if (format === "knockout") {
      fixtures = generateKnockout(teams, startDate, intervalDays)
    } else if (format === "group-knockout") {
      const groupCount = Math.max(1, Number(body.groupCount) || 2)
      const qualifiersPerGroup = Math.max(1, Number(body.qualifiersPerGroup) || 2)
      fixtures = generateGroupKnockout(
        teams,
        groupCount,
        qualifiersPerGroup,
        startDate,
        intervalDays
      )
    } else {
      return NextResponse.json(
        { error: `Unknown format: ${format}` },
        { status: 400 }
      )
    }

    // Filter out TBD matches (knockout placeholders for undetermined qualifiers)
    const creatable = fixtures.filter((f) => f.team1Id !== "TBD" && f.team2Id !== "TBD")

    // Bulk-create matches via raw SQL (avoids Prisma DateTime serialization issues)
    const nowIso = new Date().toISOString()
    const created: { id: string; matchNo: number; team1Id: string; team2Id: string; dateISO: string }[] = []

    await db.$transaction(async (tx) => {
      for (const f of creatable) {
        const id = randomUUID()
        await tx.$executeRawUnsafe(
          `INSERT INTO "Match" (id, seriesId, team1Id, team2Id, format, matchNo, status, venue, city, startDate, result, manOfMatch, umpires, tvUmpire, referee, scorecard, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, '', ?, '', NULL, '', '', '', '', ?, ?)`,
          id,
          seriesId,
          f.team1Id,
          f.team2Id,
          matchFormat,
          `${f.matchNo}${f.knockoutRound ? ` (${f.knockoutRound})` : f.group ? ` (${f.group})` : ""}`,
          venue,
          f.dateISO,
          nowIso,
          nowIso,
        )
        created.push({
          id,
          matchNo: f.matchNo,
          team1Id: f.team1Id,
          team2Id: f.team2Id,
          dateISO: f.dateISO,
        })
      }
    })

    return NextResponse.json({
      ok: true,
      format,
      teamsCount: teams.length,
      generated: fixtures.length,
      created: created.length,
      skipped: fixtures.length - created.length,
      matches: created,
    })
  } catch (e) {
    return NextResponse.json(
      { error: String(e).slice(0, 300) },
      { status: 500 }
    )
  }
}
