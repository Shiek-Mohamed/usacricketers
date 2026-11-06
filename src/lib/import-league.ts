/**
 * League import helpers (Task 11 — Approach A: generic JSON upload).
 *
 * Pure functions for parsing + loading an ImportedLeagueData JSON file into
 * the database. No React, no Next.js Request objects — just data
 * transformation + Prisma calls. The caller wraps the whole import in a
 * single `db.$transaction(async (tx) => { ... })` so the import is atomic.
 *
 * Design choices (see agent-ctx/11-import-league.md for the full rationale):
 *
 * 1. **Idempotency** — every findOrCreate uses a unique-key lookup before
 *    insert. Re-running the same import with the same JSON must NOT create
 *    duplicates. Composite keys where appropriate (Match: seriesId +
 *    team1Id + team2Id + startDate + matchNo).
 *
 * 2. **Player matching (Approach A first cut)** — NO fuzzy matching. Look
 *    up by exact `{name, teamId}`. If not found, create. The admin can
 *    dedupe via SQL after import (`UPDATE Player ... WHERE name LIKE ...`).
 *
 * 3. **Scorecard format** — the imported `scorecard` field uses OUR NATIVE
 *    `Scorecard` JSON shape (the same one stored in `Match.scorecard`).
 *    Approach A does NOT translate foreign scorecard formats — that comes
 *    with the per-platform scrapers in Approach B. The only normalization
 *    we apply is rewriting `innings[].teamId` from the imported shortName
 *    placeholder to the resolved Prisma team ID (so the standings route +
 *    scorecard UI can match innings to teams). All other scorecard fields
 *    are stored as-is via JSON.stringify(). The route resolves shortName→id
 *    BEFORE calling findOrCreateMatch (see `resolveScorecardTeamIds`).
 *
 * 4. **Standing recalculation** — after all matches are imported, clear
 *    the Standing rows for the series + recompute from completed matches.
 *    NRR formula: (runs/overs) - (opponent_runs/opponent_overs), matching
 *    the existing /api/standings route.
 *
 * 5. **Series auto-derivation** — if `league.shortName` is empty, derive
 *    from the league name (first letters of each word, uppercase, max 6
 *    chars). E.g. "Example T20 Cricket League" → "ETCL".
 */

import type { Prisma } from "@prisma/client"
import type {
  ImportedLeagueData,
  ImportedLeague,
  ImportedTeam,
  ImportedPlayer,
  ImportedMatch,
} from "./types"
import type { Scorecard, Series, Team, Player, Match } from "./types"

/** Prisma transaction client — passed in by the caller's `db.$transaction`. */
type Tx = Prisma.TransactionClient

/** Helper type returned by findOrCreate* helpers. */
interface FindOrCreateResult<T> {
  record: T
  created: boolean
}

/* -------------------------------------------------------------------------- */
/*                              JSON parsing                                  */
/* -------------------------------------------------------------------------- */

/**
 * Parse + validate the uploaded JSON. Throws on malformed shape with a
 * human-readable message suitable for surfacing in the API response.
 *
 * Validation is intentionally permissive on optional fields (defaults are
 * applied downstream by the findOrCreate* helpers) but strict on required
 * fields (league.name, every team's shortName, every match's
 * team1ShortName/team2ShortName/startDate).
 */
export function parseImportedLeagueData(jsonString: string): ImportedLeagueData {
  let raw: unknown
  try {
    raw = JSON.parse(jsonString)
  } catch (e) {
    throw new Error(`invalid JSON: ${(e as Error).message}`)
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("top-level JSON must be an object")
  }
  const obj = raw as Record<string, unknown>

  // ── league ────────────────────────────────────────────────────────────
  const league = obj.league
  if (typeof league !== "object" || league === null || Array.isArray(league)) {
    throw new Error("missing or invalid `league` object")
  }
  const l = league as Record<string, unknown>
  if (typeof l.name !== "string" || !l.name.trim()) {
    throw new Error("league.name is required (non-empty string)")
  }

  // ── teams ─────────────────────────────────────────────────────────────
  const teamsRaw = obj.teams
  if (!Array.isArray(teamsRaw)) {
    throw new Error("teams must be an array")
  }
  if (teamsRaw.length === 0) {
    throw new Error("teams array is empty — at least one team is required")
  }
  const teams: ImportedTeam[] = []
  const seenShortNames = new Set<string>()
  for (let i = 0; i < teamsRaw.length; i++) {
    const t = teamsRaw[i] as Record<string, unknown>
    if (typeof t !== "object" || t === null || Array.isArray(t)) {
      throw new Error(`teams[${i}] must be an object`)
    }
    if (typeof t.name !== "string" || !t.name.trim()) {
      throw new Error(`teams[${i}].name is required`)
    }
    if (typeof t.shortName !== "string" || !t.shortName.trim()) {
      throw new Error(`teams[${i}].shortName is required`)
    }
    const sn = t.shortName.trim()
    if (seenShortNames.has(sn.toLowerCase())) {
      throw new Error(`teams[${i}].shortName "${sn}" duplicates an earlier team`)
    }
    seenShortNames.add(sn.toLowerCase())

    // Validate players array if present.
    let players: ImportedPlayer[] | undefined
    if (t.players !== undefined) {
      if (!Array.isArray(t.players)) {
        throw new Error(`teams[${i}].players must be an array if present`)
      }
      players = []
      for (let j = 0; j < t.players.length; j++) {
        const p = t.players[j] as Record<string, unknown>
        if (typeof p !== "object" || p === null || Array.isArray(p)) {
          throw new Error(`teams[${i}].players[${j}] must be an object`)
        }
        if (typeof p.name !== "string" || !p.name.trim()) {
          throw new Error(`teams[${i}].players[${j}].name is required`)
        }
        players.push({
          name: p.name.trim(),
          role: typeof p.role === "string" ? p.role : undefined,
          isCaptain: typeof p.isCaptain === "boolean" ? p.isCaptain : undefined,
          isKeeper: typeof p.isKeeper === "boolean" ? p.isKeeper : undefined,
          battingStyle: typeof p.battingStyle === "string" ? p.battingStyle : undefined,
          bowlingStyle: typeof p.bowlingStyle === "string" ? p.bowlingStyle : undefined,
          imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : undefined,
          bio: typeof p.bio === "string" ? p.bio : undefined,
        })
      }
    }

    teams.push({
      name: t.name.trim(),
      shortName: sn,
      primaryColor: typeof t.primaryColor === "string" ? t.primaryColor : undefined,
      accentColor: typeof t.accentColor === "string" ? t.accentColor : undefined,
      country: typeof t.country === "string" ? t.country : undefined,
      description: typeof t.description === "string" ? t.description : undefined,
      players,
    })
  }

  // ── matches ───────────────────────────────────────────────────────────
  let matches: ImportedMatch[] | undefined
  if (obj.matches !== undefined) {
    if (!Array.isArray(obj.matches)) {
      throw new Error("matches must be an array if present")
    }
    matches = []
    for (let i = 0; i < obj.matches.length; i++) {
      const m = obj.matches[i] as Record<string, unknown>
      if (typeof m !== "object" || m === null || Array.isArray(m)) {
        throw new Error(`matches[${i}] must be an object`)
      }
      if (typeof m.team1ShortName !== "string" || !m.team1ShortName.trim()) {
        throw new Error(`matches[${i}].team1ShortName is required`)
      }
      if (typeof m.team2ShortName !== "string" || !m.team2ShortName.trim()) {
        throw new Error(`matches[${i}].team2ShortName is required`)
      }
      if (typeof m.startDate !== "string" || !m.startDate.trim()) {
        throw new Error(`matches[${i}].startDate is required (ISO datetime)`)
      }
      // Validate that startDate is parseable.
      const d = new Date(m.startDate)
      if (isNaN(d.getTime())) {
        throw new Error(`matches[${i}].startDate is not a valid date: ${m.startDate}`)
      }
      matches.push({
        matchNo: typeof m.matchNo === "string" ? m.matchNo : undefined,
        format: typeof m.format === "string" ? m.format : undefined,
        team1ShortName: m.team1ShortName.trim(),
        team2ShortName: m.team2ShortName.trim(),
        venue: typeof m.venue === "string" ? m.venue : undefined,
        city: typeof m.city === "string" ? m.city : undefined,
        startDate: m.startDate,
        status: typeof m.status === "string" ? m.status : undefined,
        result: typeof m.result === "string" ? m.result : undefined,
        manOfMatch: typeof m.manOfMatch === "string" ? m.manOfMatch : undefined,
        scorecard: m.scorecard as Scorecard | undefined,
      })
    }
  }

  return {
    league: {
      name: l.name.trim(),
      shortName: typeof l.shortName === "string" ? l.shortName.trim() : undefined,
      format: typeof l.format === "string" ? l.format : undefined,
      season: typeof l.season === "string" ? l.season : undefined,
      startDate: typeof l.startDate === "string" ? l.startDate : undefined,
      endDate: typeof l.endDate === "string" ? l.endDate : undefined,
      description: typeof l.description === "string" ? l.description : undefined,
    },
    teams,
    matches,
  }
}

/* -------------------------------------------------------------------------- */
/*                              helpers                                       */
/* -------------------------------------------------------------------------- */

/**
 * Derive a shortName from a league/team name by taking the first letter of
 * each word, uppercased, truncated to `maxLen`. Falls back to the first
 * `maxLen` chars of the name if the result is empty (single-word name).
 *
 * E.g. "Example T20 Cricket League" → "ETCL"
 *      "India"                       → "INDIA"  (single-word fallback)
 */
export function deriveShortName(name: string, maxLen = 6): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter((c) => c && /[a-z0-9]/i.test(c))
    .join("")
    .toUpperCase()
  if (initials.length > 0) return initials.slice(0, maxLen)
  // Single-word or all-punctuation — fall back to first chars of the name.
  return name.trim().slice(0, maxLen).toUpperCase()
}

/**
 * Walk the imported scorecard and rewrite `innings[].teamId` from the
 * imported shortName placeholder to the resolved Prisma team ID. This is
 * the ONLY scorecard normalization we do — the structural fields (batting
 * lines, bowling lines, fall of wickets) are stored as-is per the spec.
 *
 * If `innings[i].teamId` doesn't match any shortName in `teamMap`, we leave
 * it alone (the admin may have already used the real Prisma ID, or it may
 * be an unrelated value they need to fix in the scorecard editor).
 *
 * The route calls this BEFORE findOrCreateMatch so the helper itself can
 * just `JSON.stringify(scorecard)` and store as-is.
 */
export function resolveScorecardTeamIds(
  scorecard: Scorecard,
  teamMap: Map<string, string>,
): Scorecard {
  const innings = scorecard.innings.map((inn) => {
    // If teamId looks like a shortName we know, swap it for the real ID.
    // Try both the original casing and the uppercased version so "EST" /
    // "est" / "Est" all resolve. (teamMap keys are uppercase by convention
    // — see the route's teamMap.set call.)
    const resolved = inn.teamId
      ? teamMap.get(inn.teamId) || teamMap.get(inn.teamId.toUpperCase())
      : undefined
    if (resolved) {
      return {
        ...inn,
        teamId: resolved,
        teamShortName: inn.teamShortName || inn.teamId,
      }
    }
    return inn
  })
  return { ...scorecard, innings }
}

/* -------------------------------------------------------------------------- */
/*                              findOrCreate*                                 */
/* -------------------------------------------------------------------------- */

/**
 * Look up the Series by `{name, season}`. If not found, create.
 *
 * Season defaults to the current year if not provided. shortName is
 * auto-derived from `name` if not provided (first-letter-of-each-word,
 * max 6 chars). Status defaults to "ongoing" since a league with matches
 * being imported is presumably in progress.
 */
export async function findOrCreateSeries(
  league: ImportedLeague,
  tx: Tx,
): Promise<FindOrCreateResult<Series>> {
  const season = league.season?.trim() || new Date().getFullYear().toString()
  const name = league.name.trim()
  const shortName = league.shortName?.trim() || deriveShortName(name, 6)
  const format = league.format?.trim() || "T20"
  const startDate = league.startDate ? new Date(league.startDate) : new Date()
  const endDate = league.endDate
    ? new Date(league.endDate)
    : new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 60) // +60d default
  const description = league.description?.trim() || ""

  // Look up by (name, season) — the natural identity of a series.
  // (name + season isn't @@unique in the schema, so use findFirst.)
  const existing = await tx.series.findFirst({
    where: { name, season },
  })
  if (existing) {
    // Update mutable fields (description, dates, format) — keep the original
    // shortName so external references stay stable, but bring everything
    // else in line with the import.
    const updated = await tx.series.update({
      where: { id: existing.id },
      data: {
        format,
        startDate,
        endDate,
        description: description || existing.description,
      },
    })
    return { record: toSeries(updated), created: false }
  }

  const created = await tx.series.create({
    data: {
      name,
      shortName,
      format,
      season,
      startDate,
      endDate,
      status: "ongoing",
      description,
    },
  })
  return { record: toSeries(created), created: true }
}

/**
 * Look up a Team by `shortName` (case-insensitive). If not found, create.
 * If found, update mutable fields (name, country, colors, description) so
 * re-imports with updated team info are reflected.
 *
 * shortName is treated as the global identity of a team — two different
 * leagues using "EST" both refer to the same team row. This matches the
 * existing admin + league-admin team-create flow.
 */
export async function findOrCreateTeam(
  teamData: ImportedTeam,
  tx: Tx,
): Promise<FindOrCreateResult<Team>> {
  // Normalise the shortName to uppercase on lookup AND on create — this
  // gives us case-insensitive matching without `mode: "insensitive"`
  // (which is a Postgres-only Prisma feature, not available on SQLite).
  // Matches the existing admin team-create pattern: `shortName.toUpperCase()`.
  const shortName = teamData.shortName.trim().toUpperCase()
  const name = teamData.name.trim()
  // Spec says "will be overridden to non-blue if possible" — for Approach A
  // we honour the imported color verbatim if provided, else fall back to the
  // navy default from the schema. Future per-platform scrapers can override
  // blue defaults; the generic importer is colour-blind.
  const primaryColor = teamData.primaryColor?.trim() || "#1e3a8a"
  const accentColor = teamData.accentColor?.trim() || "#f59e0b"
  const country = teamData.country?.trim() || ""
  const description = teamData.description?.trim() || ""

  const existing = await tx.team.findFirst({
    where: { shortName },
  })
  if (existing) {
    const updated = await tx.team.update({
      where: { id: existing.id },
      data: {
        name,
        // Don't change shortName on update — it's the identity key.
        country: country || existing.country,
        primaryColor,
        accentColor,
        description: description || existing.description,
      },
    })
    return { record: toTeam(updated), created: false }
  }

  const created = await tx.team.create({
    data: {
      name,
      shortName,
      country,
      primaryColor,
      accentColor,
      description,
    },
  })
  return { record: toTeam(created), created: true }
}

/**
 * Look up a Player by exact `{name, teamId}`. If not found, create.
 *
 * NOTE (Approach A first cut): NO fuzzy matching. Two players named
 * "John Smith" on the same team will collide into one row on re-import
 * (since we look up by exact name + teamId). The admin can dedupe via
 * SQL after import (`UPDATE Player SET name = ... WHERE id = ...`) if
 * they need to split duplicates. This is intentional — fuzzy matching
 * (Levenshtein, etc.) would silently merge players that shouldn't be.
 */
export async function findOrCreatePlayer(
  playerData: ImportedPlayer,
  teamId: string,
  tx: Tx,
): Promise<FindOrCreateResult<Player>> {
  const name = playerData.name.trim()
  const role = playerData.role?.trim() || "Batsman"
  const isCaptain = playerData.isCaptain ?? false
  const isKeeper = playerData.isKeeper ?? false
  const battingStyle = playerData.battingStyle?.trim() || "Right-hand bat"
  const bowlingStyle = playerData.bowlingStyle?.trim() || ""
  const imageUrl = playerData.imageUrl?.trim() || ""
  const bio = playerData.bio?.trim() || ""

  // Look up by exact name + teamId. (No @@unique constraint, so use findFirst.)
  const existing = await tx.player.findFirst({
    where: { name, teamId },
  })
  if (existing) {
    const updated = await tx.player.update({
      where: { id: existing.id },
      data: {
        role,
        isCaptain,
        isKeeper,
        battingStyle,
        bowlingStyle,
        imageUrl,
        bio,
      },
    })
    return { record: toPlayer(updated), created: false }
  }

  const created = await tx.player.create({
    data: {
      name,
      teamId,
      role,
      isCaptain,
      isKeeper,
      battingStyle,
      bowlingStyle,
      imageUrl,
      bio,
    },
  })
  return { record: toPlayer(created), created: true }
}

/**
 * Look up a Match by composite key `{seriesId, team1Id, team2Id, startDate,
 * matchNo}`. If exists, update (status/result/scorecard); else create.
 *
 * The composite key is intentionally specific so two matches between the
 * same teams on the same date with different match numbers (e.g. a
 * double-header) are treated as distinct. startDate is compared at
 * millisecond precision — admins should use a unique time per match in
 * the JSON file.
 *
 * Scorecard: the caller should pass a scorecard whose `innings[].teamId`
 * has already been resolved from shortName → Prisma ID via
 * `resolveScorecardTeamIds()` (route-level concern). This helper stores
 * the scorecard as-is via JSON.stringify() — no format translation.
 */
export async function findOrCreateMatch(
  matchData: ImportedMatch,
  seriesId: string,
  team1Id: string,
  team2Id: string,
  tx: Tx,
): Promise<FindOrCreateResult<Match>> {
  const matchNo = matchData.matchNo?.trim() || "1st Match"
  const format = matchData.format?.trim() || "T20"
  const venue = matchData.venue?.trim() || ""
  const city = matchData.city?.trim() || ""
  const startDate = new Date(matchData.startDate)
  const status = (matchData.status?.trim() || "upcoming") as Match["status"]
  const result = matchData.result?.trim() || ""
  const manOfMatch = matchData.manOfMatch?.trim() || null
  // Store the scorecard as-is — the route resolved teamId shortNames → IDs
  // before calling us (see resolveScorecardTeamIds).
  const scorecardJson = matchData.scorecard ? JSON.stringify(matchData.scorecard) : ""

  // Look up by composite key. (No @@unique constraint, so use findFirst.)
  const existing = await tx.match.findFirst({
    where: {
      seriesId,
      team1Id,
      team2Id,
      matchNo,
      startDate,
    },
  })

  if (existing) {
    const updated = await tx.match.update({
      where: { id: existing.id },
      data: {
        format,
        status,
        venue: venue || existing.venue,
        city: city || existing.city,
        result,
        manOfMatch,
        scorecard: scorecardJson || existing.scorecard,
      },
    })
    return { record: toMatch(updated), created: false }
  }

  const created = await tx.match.create({
    data: {
      seriesId,
      team1Id,
      team2Id,
      format,
      matchNo,
      status,
      venue,
      city,
      startDate,
      result,
      manOfMatch,
      scorecard: scorecardJson,
    },
  })
  return { record: toMatch(created), created: true }
}

/**
 * Join a team to a series via TournamentTeam. Idempotent — uses upsert on
 * the @@unique([seriesId, teamId]) constraint, so re-running is a no-op.
 */
export async function joinTeamToSeries(
  teamId: string,
  seriesId: string,
  tx: Tx,
): Promise<void> {
  await tx.tournamentTeam.upsert({
    where: { seriesId_teamId: { seriesId, teamId } },
    update: {}, // no fields to update — the join table has only ids + timestamps
    create: { seriesId, teamId },
  })
}

/* -------------------------------------------------------------------------- */
/*                              standings                                     */
/* -------------------------------------------------------------------------- */

/**
 * Clear + recompute the Standing rows for a series from all completed
 * matches. Iterates completed matches, computes played/won/lost/tied/
 * points/NRR per team. Idempotent — safe to call after every import.
 *
 * NRR formula (matches /api/standings/route.ts):
 *   nrr = (forRuns / forOvers) - (againstRuns / againstOvers)
 * Points: 2 per win, 1 per tie, 0 per loss.
 *
 * Returns { teams, matches } — counts for the import summary.
 */
export async function recomputeStandingsForSeries(
  seriesId: string,
  tx: Tx,
): Promise<{ teams: number; matches: number }> {
  // All teams in the series (via the TournamentTeam join).
  const teamsInSeries = await tx.tournamentTeam.findMany({
    where: { seriesId },
    select: { teamId: true },
  })
  const teamIds = teamsInSeries.map((tt) => tt.teamId)

  // Wipe existing standings for this series — recompute from scratch.
  await tx.standing.deleteMany({ where: { seriesId } })

  // Pull all completed matches in the series.
  const completedMatches = await tx.match.findMany({
    where: { seriesId, status: "completed" },
    include: { team1: true, team2: true },
  })

  // Per-team accumulator — mirrors /api/standings/route.ts.
  type Acc = {
    teamId: string
    played: number
    won: number
    lost: number
    tied: number
    points: number
    forRuns: number
    forOvers: number
    againstRuns: number
    againstOvers: number
  }
  const map = new Map<string, Acc>()
  for (const tid of teamIds) {
    map.set(tid, {
      teamId: tid,
      played: 0, won: 0, lost: 0, tied: 0, points: 0,
      forRuns: 0, forOvers: 0, againstRuns: 0, againstOvers: 0,
    })
  }

  let matchesProcessed = 0
  for (const m of completedMatches) {
    const t1 = map.get(m.team1Id)
    const t2 = map.get(m.team2Id)
    if (!t1 || !t2) continue

    const result = (m.result || "").toLowerCase()
    if (
      !result ||
      result.includes("abandoned") ||
      result.includes("no result") ||
      result.includes("no play")
    ) {
      continue
    }

    t1.played++
    t2.played++

    // Parse scorecard innings totals (if any) for NRR.
    let t1Runs = 0, t2Runs = 0, t1Overs = 0, t2Overs = 0
    try {
      const sc = m.scorecard ? (JSON.parse(m.scorecard) as Scorecard) : null
      if (sc && Array.isArray(sc.innings) && sc.innings.length >= 2) {
        for (const inn of sc.innings) {
          if (inn.teamId === m.team1Id) {
            t1Runs += inn.totalRuns
            t1Overs += parseFloat(inn.totalOvers) || 0
          } else if (inn.teamId === m.team2Id) {
            t2Runs += inn.totalRuns
            t2Overs += parseFloat(inn.totalOvers) || 0
          }
        }
        t1.forRuns += t1Runs; t1.forOvers += t1Overs
        t1.againstRuns += t2Runs; t1.againstOvers += t2Overs
        t2.forRuns += t2Runs; t2.forOvers += t2Overs
        t2.againstRuns += t1Runs; t2.againstOvers += t1Overs
      }
    } catch {
      // scorecard isn't valid JSON — skip NRR contribution for this match.
    }

    if (result.includes("tied")) {
      t1.tied++; t2.tied++
      t1.points += 1; t2.points += 1
    } else {
      const t1Won =
        result.includes(m.team1.name.toLowerCase()) ||
        result.includes(m.team1.shortName.toLowerCase())
      const t2Won =
        result.includes(m.team2.name.toLowerCase()) ||
        result.includes(m.team2.shortName.toLowerCase())
      if (t1Won && !t2Won) {
        t1.won++; t2.lost++
        t1.points += 2
      } else if (t2Won && !t1Won) {
        t2.won++; t1.lost++
        t2.points += 2
      }
      // else: can't determine winner from result string — skip win/loss.
    }
    matchesProcessed++
  }

  // Write one Standing row per team that played at least 1 match.
  for (const acc of map.values()) {
    if (acc.played === 0) continue
    const forRR = acc.forOvers > 0 ? acc.forRuns / acc.forOvers : 0
    const againstRR = acc.againstOvers > 0 ? acc.againstRuns / acc.againstOvers : 0
    const nrr = Number((forRR - againstRR).toFixed(3))
    await tx.standing.upsert({
      where: { seriesId_teamId: { seriesId, teamId: acc.teamId } },
      update: {
        played: acc.played,
        won: acc.won,
        lost: acc.lost,
        tied: acc.tied,
        points: acc.points,
        forRuns: acc.forRuns,
        forOvers: acc.forOvers,
        againstRuns: acc.againstRuns,
        againstOvers: acc.againstOvers,
        nrr,
      },
      create: {
        seriesId,
        teamId: acc.teamId,
        played: acc.played,
        won: acc.won,
        lost: acc.lost,
        tied: acc.tied,
        points: acc.points,
        forRuns: acc.forRuns,
        forOvers: acc.forOvers,
        againstRuns: acc.againstRuns,
        againstOvers: acc.againstOvers,
        nrr,
      },
    })
  }

  return { teams: teamIds.length, matches: matchesProcessed }
}

/* -------------------------------------------------------------------------- */
/*                       Prisma → typed-POJO transforms                       */
/*                                                                            */
/* These mirror serializeTeam/serializePlayer/etc. in serialize.ts but live  */
/* here so the import helpers don't take a dependency on the full serialize   */
/* module (which would pull in Article/Gallery/Video types etc.). The shape   */
/* is the same — Prisma row → typed object with ISO date strings.            */
/* -------------------------------------------------------------------------- */

function toTeam(t: Prisma.TeamGetPayload<Record<string, never>>): Team {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    country: t.country,
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    description: t.description,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  }
}

function toPlayer(p: Prisma.PlayerGetPayload<Record<string, never>>): Player {
  return {
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    role: p.role,
    isCaptain: p.isCaptain,
    isKeeper: p.isKeeper,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    // The import path doesn't care about stats — leave them as the empty
    // defaults. parseBattingStats/parseBowlingStats on read turn the JSON
    // strings into the typed shape.
    battingStats: {
      matches: 0, innings: 0, runs: 0, highest: "0",
      average: 0, strikeRate: 0, hundreds: 0, fifties: 0,
      fours: 0, sixes: 0, notOuts: 0,
    },
    bowlingStats: null,
    bio: p.bio,
    imageUrl: p.imageUrl,
    team: undefined,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
  }
}

function toSeries(s: Prisma.SeriesGetPayload<Record<string, never>>): Series {
  return {
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    format: s.format,
    season: s.season,
    startDate: new Date(s.startDate).toISOString(),
    endDate: new Date(s.endDate).toISOString(),
    status: s.status,
    description: s.description,
    teams: [],
    createdAt: new Date(s.createdAt).toISOString(),
    updatedAt: new Date(s.updatedAt).toISOString(),
  }
}

function toMatch(m: Prisma.MatchGetPayload<Record<string, never>>): Match {
  let scorecard: Scorecard | null = null
  if (m.scorecard) {
    try {
      const parsed = JSON.parse(m.scorecard)
      if (parsed && Array.isArray(parsed.innings)) {
        scorecard = parsed as Scorecard
      }
    } catch {
      scorecard = null
    }
  }
  return {
    id: m.id,
    seriesId: m.seriesId,
    team1Id: m.team1Id,
    team2Id: m.team2Id,
    format: m.format,
    matchNo: m.matchNo,
    status: m.status,
    venue: m.venue,
    city: m.city,
    startDate: new Date(m.startDate).toISOString(),
    result: m.result,
    manOfMatch: m.manOfMatch,
    umpires: m.umpires,
    tvUmpire: m.tvUmpire,
    referee: m.referee,
    scorecard,
    team1: undefined,
    team2: undefined,
    series: null,
    createdAt: new Date(m.createdAt).toISOString(),
    updatedAt: new Date(m.updatedAt).toISOString(),
  }
}
