import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import {
  parseImportedLeagueData,
  findOrCreateSeries,
  findOrCreateTeam,
  findOrCreatePlayer,
  findOrCreateMatch,
  joinTeamToSeries,
  recomputeStandingsForSeries,
  resolveScorecardTeamIds,
} from "@/lib/import-league"
import type { ImportedLeagueData } from "@/lib/types"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 minutes — large imports can take a while

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

/**
 * POST /api/admin/import-league
 *
 * Body: multipart/form-data with a single "file" field containing a JSON
 * file matching the ImportedLeagueData schema (see src/lib/types.ts +
 * templates/import-league.example.json).
 *
 * Auth: site-admin only (requireSiteAdmin cookie guard — same pattern as
 * /api/upload). League-admin bearer tokens are intentionally rejected;
 * the league importer is a Tier-1 operation since it can write to ANY
 * series in the database, not just ones the league admin manages.
 *
 * The entire import runs in a single `db.$transaction` for atomicity —
 * if any step fails (parse error, FK violation, etc.) the whole import
 * rolls back, leaving the database in the pre-import state.
 *
 * Returns a summary of created/updated counts per entity type:
 *   { series, teams, players, matches, standings }
 *
 * Idempotent: re-running with the same JSON updates existing rows instead
 * of creating duplicates. The second run reports created=0 across all
 * entities.
 */
export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  // requireSiteAdmin reads the sa-session cookie + verifies the CSRF
  // double-submit header. Returns null on any failure.
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    // ── Parse multipart form ─────────────────────────────────────────
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json(
        { error: "no file provided" },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      )
    }

    // Single-shot file.text() — don't load the file into memory multiple
    // times. JSON.parse is then a CPU-only operation on the string.
    const jsonString = await file.text()

    // ── Parse + validate JSON shape ──────────────────────────────────
    let parsed: ImportedLeagueData
    try {
      parsed = parseImportedLeagueData(jsonString)
    } catch (e) {
      return NextResponse.json(
        { error: `invalid JSON: ${(e as Error).message}` },
        { status: 400 }
      )
    }

    // ── Run the entire import in a single transaction ────────────────
    // If any step fails, the whole import rolls back — no partial state.
    const result = await db.$transaction(async (tx) => {
      // 1. Find-or-create the Series (league). Returns the seriesId we'll
      // use for all subsequent lookups.
      const { record: series, created: seriesCreated } =
        await findOrCreateSeries(parsed.league, tx)

      // 2. Find-or-create all teams + their players + join to series.
      // Build a shortName → teamId map for resolving match + scorecard
      // references in steps 3 + scorecard teamId normalization.
      const teamMap = new Map<string, string>() // shortName (uppercase) → teamId
      let teamsCreated = 0
      let teamsUpdated = 0
      let playersCreated = 0
      let playersUpdated = 0
      for (const td of parsed.teams) {
        const { record: team, created } = await findOrCreateTeam(td, tx)
        // Uppercase the key so case-insensitive lookups from the scorecard
        // (innings[].teamId) and match (team1ShortName/team2ShortName)
        // both resolve to the same team ID regardless of source casing.
        teamMap.set(td.shortName.toUpperCase(), team.id)
        if (created) teamsCreated++
        else teamsUpdated++

        // Join the team to this series (idempotent — TournamentTeam has a
        // @@unique([seriesId, teamId]) constraint).
        await joinTeamToSeries(team.id, series.id, tx)

        // Players (optional — can be empty if only fixtures are imported).
        if (td.players) {
          for (const pd of td.players) {
            const { created: pCreated } = await findOrCreatePlayer(
              pd,
              team.id,
              tx
            )
            if (pCreated) playersCreated++
            else playersUpdated++
          }
        }
      }

      // 3. Find-or-create all matches. Pre-resolve scorecard teamId
      // shortNames → Prisma IDs so the standings recompute can match
      // innings to teams.
      let matchesCreated = 0
      let matchesUpdated = 0
      const matchErrors: string[] = []
      for (const md of parsed.matches ?? []) {
        const t1Id = teamMap.get(md.team1ShortName.toUpperCase())
        const t2Id = teamMap.get(md.team2ShortName.toUpperCase())
        if (!t1Id || !t2Id) {
          matchErrors.push(
            `match ${md.matchNo ?? "(no matchNo)"}: team "${md.team1ShortName}" or "${md.team2ShortName}" not found in teams array`
          )
          continue
        }

        // Resolve scorecard teamId shortNames → Prisma IDs (only if the
        // scorecard has innings whose teamId matches a known shortName).
        const matchWithResolvedScorecard = md.scorecard
          ? { ...md, scorecard: resolveScorecardTeamIds(md.scorecard, teamMap) }
          : md

        const { created } = await findOrCreateMatch(
          matchWithResolvedScorecard,
          series.id,
          t1Id,
          t2Id,
          tx
        )
        if (created) matchesCreated++
        else matchesUpdated++
      }

      // 4. Recompute standings for the series from all completed matches.
      // Idempotent — wipes + repopulates the Standing rows.
      const standings = await recomputeStandingsForSeries(series.id, tx)

      return {
        series: {
          id: series.id,
          name: series.name,
          shortName: series.shortName,
          season: series.season,
          created: seriesCreated,
        },
        teams: {
          total: parsed.teams.length,
          created: teamsCreated,
          updated: teamsUpdated,
        },
        players: {
          created: playersCreated,
          updated: playersUpdated,
        },
        matches: {
          total: parsed.matches?.length ?? 0,
          created: matchesCreated,
          updated: matchesUpdated,
          errors: matchErrors,
        },
        standings: {
          teams: standings.teams,
          matches: standings.matches,
        },
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (e) {
    // Any unhandled error in the transaction — surface a short message.
    // The transaction has already rolled back, so the DB is in the
    // pre-import state.
    return NextResponse.json(
      { error: String(e).slice(0, 300) },
      { status: 500 }
    )
  }
}
