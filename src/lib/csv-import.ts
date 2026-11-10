/**
 * CSV importer for cricket league data.
 *
 * Accepts CSV exports from CricClubs, PlayCricket, MyCricket, or any platform
 * that exports team/player/match data as CSV. The parser is column-header-aware:
 * it matches header names flexibly (e.g., "Team Name", "team_name", "teamname"
 * all map to the same field) so it works with different export formats.
 *
 * Usage:
 *   const data = parseCsvImport({
 *     teamsCsv: "...",      // optional
 *     playersCsv: "...",    // optional
 *     matchesCsv: "...",    // optional
 *     leagueName: "Arizona Premier Cricket League",
 *     season: "2025",
 *     format: "T20",
 *   })
 *   // → returns ImportedLeagueData JSON
 *   // → feed to importLeagueData() for DB import
 */

import type {
  ImportedLeagueData,
  ImportedLeague,
  ImportedTeam,
  ImportedPlayer,
  ImportedMatch,
} from "./types"
import type { Scorecard, BattingLine, BowlingLine } from "./types"

/* -------------------------------------------------------------------------- */
/*  CSV parsing                                                                */
/* -------------------------------------------------------------------------- */

/** Parse a CSV string into rows of string arrays. Handles quoted fields,
 *  embedded commas, and both \n and \r\n line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        current.push(field.trim())
        field = ""
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && next === "\n") i++
        current.push(field.trim())
        field = ""
        if (current.some((c) => c !== "")) rows.push(current)
        current = []
      } else {
        field += char
      }
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field.trim())
    if (current.some((c) => c !== "")) rows.push(current)
  }
  return rows
}

/** Convert rows to objects using the first row as headers.
 *  Normalizes headers to lowercase + snake_case for flexible matching. */
function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const headers = rows[0].map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, ""),
  )
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? "").trim()
    })
    return obj
  })
}

/* -------------------------------------------------------------------------- */
/*  Flexible header matching                                                   */
/* -------------------------------------------------------------------------- */

/** Check if any of the given header aliases exists in the object. */
function getField(obj: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const key = alias.toLowerCase().replace(/[^a-z0-9]/g, "_")
    if (obj[key] !== undefined && obj[key] !== "") return obj[key]
  }
  return ""
}

/* -------------------------------------------------------------------------- */
/*  Team parser                                                                */
/* -------------------------------------------------------------------------- */

export function parseTeamsCsv(csv: string): ImportedTeam[] {
  const rows = parseCsv(csv)
  const objects = rowsToObjects(rows)
  return objects.map((o) => {
    const name = getField(o, ["team_name", "team", "teamname", "name", "club", "club_name"])
    const shortName = getField(o, ["short_name", "shortname", "abbr", "abbreviation", "code"])
    return {
      name: name || "Unknown Team",
      shortName: shortName || name.slice(0, 4).toUpperCase(),
      primaryColor: "#1e2a5e",
      accentColor: "#f59e0b",
      country: getField(o, ["country", "region", "city", "location"]) || "",
    }
  }).filter((t) => t.name !== "Unknown Team" || t.shortName)
}

/* -------------------------------------------------------------------------- */
/*  Player parser                                                              */
/* -------------------------------------------------------------------------- */

export function parsePlayersCsv(csv: string): ImportedPlayer[] {
  const rows = parseCsv(csv)
  const objects = rowsToObjects(rows)
  return objects.map((o) => {
    const name = getField(o, ["player_name", "name", "player", "fullname", "full_name"])
    const teamName = getField(o, ["team", "team_name", "club", "club_name"])
    const role = getField(o, ["role", "playing_role", "position"])
    return {
      name: name || "Unknown Player",
      teamShortName: teamName,
      role: normalizeRole(role),
      isCaptain: /captain/i.test(role),
      isKeeper: /keeper|wicket/i.test(role),
      battingStyle: normalizeBatting(getField(o, ["batting_style", "batting", "bats"])),
      bowlingStyle: getField(o, ["bowling_style", "bowling", "bowls"]) || "",
    }
  }).filter((p) => p.name !== "Unknown Player")
}

function normalizeRole(role: string): string {
  const r = role.toLowerCase()
  if (r.includes("batsman") || r.includes("batter")) return "Batsman"
  if (r.includes("bowler")) return "Bowler"
  if (r.includes("all") && r.includes("round")) return "All-rounder"
  if (r.includes("keeper") || r.includes("wicket")) return "Wicket-keeper"
  return "Batsman"
}

function normalizeBatting(style: string): string {
  const s = style.toLowerCase()
  if (s.includes("left")) return "Left-hand bat"
  return "Right-hand bat"
}

/* -------------------------------------------------------------------------- */
/*  Match parser                                                               */
/* -------------------------------------------------------------------------- */

export function parseMatchesCsv(csv: string): ImportedMatch[] {
  const rows = parseCsv(csv)
  const objects = rowsToObjects(rows)
  return objects.map((o) => {
    const team1 = getField(o, ["team1", "team_1", "home_team", "team1_name", "home"])
    const team2 = getField(o, ["team2", "team_2", "away_team", "team2_name", "away"])
    const date = getField(o, ["date", "match_date", "start_date", "scheduled"])
    const venue = getField(o, ["venue", "ground", "location", "stadium"])
    const result = getField(o, ["result", "outcome", "winner"])
    const matchNo = getField(o, ["match_no", "match_number", "matchno", "game_no"])
    const format = getField(o, ["format", "type", "match_type"]) || "T20"
    const status = result ? "completed" : "upcoming"

    // Parse date — try multiple formats
    let isoDate = new Date().toISOString()
    if (date) {
      const parsed = new Date(date)
      if (!isNaN(parsed.getTime())) isoDate = parsed.toISOString()
    }

    return {
      team1ShortName: team1.slice(0, 6).toUpperCase(),
      team2ShortName: team2.slice(0, 6).toUpperCase(),
      team1Name: team1,
      team2Name: team2,
      startDate: isoDate,
      matchNo: matchNo || `${team1.slice(0, 3).toUpperCase()} v ${team2.slice(0, 3).toUpperCase()}`,
      venue: venue || "",
      city: "",
      format: format.toUpperCase().includes("T20") ? "T20" :
              format.toUpperCase().includes("ODI") || format.toUpperCase().includes("50") ? "ODI" :
              format.toUpperCase().includes("TEST") ? "Test" : "T20",
      status: status as "completed" | "upcoming",
      result: result || "",
      scorecard: null as Scorecard | null,
    }
  }).filter((m) => m.team1Name && m.team2Name)
}

/* -------------------------------------------------------------------------- */
/*  Main entry point — combine all CSVs into ImportedLeagueData               */
/* -------------------------------------------------------------------------- */

export interface CsvImportInput {
  leagueName: string
  season: string
  format: string
  teamsCsv?: string
  playersCsv?: string
  matchesCsv?: string
}

export function parseCsvImport(input: CsvImportInput): ImportedLeagueData {
  const teams = input.teamsCsv ? parseTeamsCsv(input.teamsCsv) : []
  const players = input.playersCsv ? parsePlayersCsv(input.playersCsv) : []
  const matches = input.matchesCsv ? parseMatchesCsv(input.matchesCsv) : []

  const league: ImportedLeague = {
    name: input.leagueName,
    shortName: input.leagueName
      .replace(/[^a-zA-Z0-9]/g, " ")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 6) || input.leagueName.slice(0, 6),
    format: input.format || "T20",
    season: input.season || String(new Date().getFullYear()),
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    status: "ongoing",
    description: "",
  }

  return {
    league,
    teams,
    players,
    matches,
  }
}

/* -------------------------------------------------------------------------- */
/*  Preview helper — returns counts for UI display                            */
/* -------------------------------------------------------------------------- */

export function previewCsvImport(input: CsvImportInput): {
  teamCount: number
  playerCount: number
  matchCount: number
  sampleTeams: string[]
  sampleMatches: string[]
} {
  const data = parseCsvImport(input)
  return {
    teamCount: data.teams.length,
    playerCount: data.players.length,
    matchCount: data.matches.length,
    sampleTeams: data.teams.slice(0, 5).map((t) => t.name),
    sampleMatches: data.matches.slice(0, 5).map((m) => `${m.team1Name} v ${m.team2Name}`),
  }
}
