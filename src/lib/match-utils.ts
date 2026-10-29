/**
 * Pure helpers for the Schedule page and MatchCard component.
 *
 * No JSX, no React, no Zustand — just data transformations so they can be
 * unit-tested in isolation and re-used by admin views or scorer pages later.
 *
 * NOTE on series progress: the on-the-wire `Match.series` object does NOT carry
 * a `matches[]` field (see `serializeSeries` in `src/lib/serialize.ts`). To
 * compute a series scoreline we therefore need the full matches list from the
 * caller. `getSeriesProgress` accepts an optional `allMatches` arg for that.
 */

import type { Innings, Match } from "./types"

export type StatusPillColor = "red" | "amber" | "emerald" | "slate"

export interface StatusPillInfo {
  label: string
  color: StatusPillColor
  pulse: boolean
}

/**
 * Resolve the status pill shown in the top-right of a MatchCard.
 *
 * - live     → "LIVE",     red,    pulsing dot
 * - completed → "RESULT",   emerald, no pulse
 * - upcoming within 24h → "TODAY", amber
 * - upcoming further out → "UPCOMING", slate
 * - abandoned → "ABANDONED", slate
 */
export function getStatusPill(match: Match): StatusPillInfo {
  switch (match.status) {
    case "live":
      return { label: "LIVE", color: "red", pulse: true }
    case "completed":
      return { label: "RESULT", color: "emerald", pulse: false }
    case "abandoned":
      return { label: "ABANDONED", color: "slate", pulse: false }
    case "upcoming": {
      const diff = new Date(match.startDate).getTime() - Date.now()
      if (diff > 0 && diff <= 24 * 60 * 60 * 1000) {
        return { label: "TODAY", color: "amber", pulse: false }
      }
      return { label: "UPCOMING", color: "slate", pulse: false }
    }
    default:
      return { label: "UPCOMING", color: "slate", pulse: false }
  }
}

/**
 * Human-friendly countdown for upcoming matches.
 *
 * - "in 45m"          if <1 hour
 * - "in 3h 20m"       if <24 hours
 * - "in 2 days"       if <7 days
 * - "in 3 weeks"      if <30 days
 * - "on Oct 23"       if further out (or already past)
 * - null              if the match is not upcoming
 */
export function getCountdown(match: Match): string | null {
  if (match.status !== "upcoming") return null

  const now = Date.now()
  const start = new Date(match.startDate).getTime()
  const diff = start - now

  if (diff <= 0) return null

  const totalMins = Math.floor(diff / 60000)
  const hours = Math.floor(totalMins / 60)
  const days = Math.floor(hours / 24)

  if (totalMins < 60) return `in ${totalMins}m`
  if (hours < 24) {
    const remMins = totalMins % 60
    return `in ${hours}h ${remMins}m`
  }
  if (days < 7) return `in ${days} ${days === 1 ? "day" : "days"}`

  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `in ${weeks} ${weeks === 1 ? "week" : "weeks"}`
  }

  return `on ${new Date(match.startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`
}

export interface SeriesProgressInfo {
  summary: string
  leader: string | null
}

/**
 * Compute a "ENG lead 1-0" / "Series level 1-1" summary for a multi-match
 * series. Returns null when there is no series, no other matches available, or
 * fewer than 2 completed matches in the series.
 *
 * The function parses each completed match's `result` text (e.g.
 * "India won by 5 wickets") to count wins per team. Drawn / tied / abandoned
 * matches contribute to neither side.
 *
 * Caller passes the full `Match[]` list (typically from `useMatches()`) so we
 * can scan sibling matches in the same series.
 */
export function getSeriesProgress(
  match: Match,
  allMatches?: Match[] | null
): SeriesProgressInfo | null {
  if (!match.seriesId || !allMatches || allMatches.length === 0) return null

  const siblings = allMatches.filter(
    (m) => m.seriesId === match.seriesId && m.status === "completed"
  )
  if (siblings.length < 2) return null

  let team1Wins = 0
  let team2Wins = 0

  for (const m of siblings) {
    const winnerId = inferWinnerId(m)
    if (winnerId && winnerId === m.team1Id) team1Wins++
    else if (winnerId && winnerId === m.team2Id) team2Wins++
  }

  const t1Short = match.team1?.shortName ?? "T1"
  const t2Short = match.team2?.shortName ?? "T2"

  if (team1Wins > team2Wins) {
    return {
      summary: `${t1Short} lead ${team1Wins}-${team2Wins}`,
      leader: match.team1Id,
    }
  }
  if (team2Wins > team1Wins) {
    return {
      summary: `${t2Short} lead ${team2Wins}-${team1Wins}`,
      leader: match.team2Id,
    }
  }
  return {
    summary: `Series level ${team1Wins}-${team2Wins}`,
    leader: null,
  }
}

/**
 * Parse a result string like "India won by 5 wickets" or "Australia won by 3
 * runs" to determine which team won. Returns the winner's teamId (matched
 * against the team names on the match), or null for drawn/tied/abandoned.
 *
 * Matching is case-insensitive on the team's full `name`. We deliberately
 * avoid matching on `shortName` because most short codes (IND, AUS, ENG) are
 * substrings of words like "India" or "Australia" and would cause false
 * positives — the full name match is safer.
 */
function inferWinnerId(match: Match): string | null {
  if (!match.result) return null
  const lower = match.result.toLowerCase()
  if (!lower.includes("won")) return null

  const t1Name = match.team1?.name?.toLowerCase()
  const t2Name = match.team2?.name?.toLowerCase()

  if (t1Name && lower.includes(t1Name)) return match.team1Id
  if (t2Name && lower.includes(t2Name)) return match.team2Id
  return null
}

export interface ResultSummary {
  team1Innings: string
  team2Innings: string
}

/**
 * For a completed match, return a short scoreline string per team (e.g.
 * "285/4" for limited-overs, "285 & 240" for a Test where each team batted
 * twice). Returns null when the match isn't completed or has no scorecard.
 */
export function getResultSummary(
  match: Match
): ResultSummary | null {
  if (match.status !== "completed" || !match.scorecard) return null

  const innings: Innings[] = match.scorecard.innings ?? []
  if (innings.length === 0) return null

  const t1Innings = innings.filter((i) => i.teamId === match.team1Id)
  const t2Innings = innings.filter((i) => i.teamId === match.team2Id)

  const renderInnings = (i: Innings): string => {
    let s = i.total?.trim() ?? ""
    if (!s) return ""
    if (match.format === "Test" && i.declared) s += " decl"
    return s
  }

  const t1Str = t1Innings.map(renderInnings).filter(Boolean).join(" & ")
  const t2Str = t2Innings.map(renderInnings).filter(Boolean).join(" & ")

  if (!t1Str && !t2Str) return null
  return { team1Innings: t1Str, team2Innings: t2Str }
}

/**
 * Build an iCalendar (.ics) Blob for an upcoming match. The caller is
 * responsible for `URL.createObjectURL(blob)` + `<a download>` click + later
 * `URL.revokeObjectURL()`. We use 8 hours as the default event duration since
 * most limited-overs fixtures finish inside that window; Tests will simply
 * show a long single-day block (calendar clients display all-day if the
 * duration straddles midnight anyway).
 */
export function addToCalendar(match: Match): Blob {
  const start = new Date(match.startDate)
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000)

  const stamp = new Date()

  const fmt = (d: Date): string =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"

  const t1 = match.team1?.shortName ?? "Team 1"
  const t2 = match.team2?.shortName ?? "Team 2"
  const summary = `${t1} vs ${t2} — ${match.format}`
  const description = match.series?.shortName
    ? `${match.series.shortName} · ${match.matchNo}`
    : match.matchNo
  const location = `${match.venue}${match.city ? `, ${match.city}` : ""}`

  // Escape commas and semicolons per RFC 5545.
  const esc = (s: string): string =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//cricinfo//schedule//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${match.id}@cricinfo`,
    `DTSTAMP:${fmt(stamp)}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(location)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Match starts in 30 minutes",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  return new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" })
}
