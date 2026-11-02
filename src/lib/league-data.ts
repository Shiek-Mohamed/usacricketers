/**
 * Server-side data fetching for the League Public Page (`/league/[slug]`).
 *
 * Each function below is a thin Prisma query wrapper that returns
 * already-shaped, plain-serializable data (no Date objects, no Prisma
 * circular refs) ready to be passed from a server-component route handler
 * into the client-side `<LeagueHomepage data={...} />` component.
 *
 * The single entry point is `getLeagueHomepageData(slug)`, which orchestrates
 * the others in parallel and returns null if no Series matches the slug.
 *
 * Player-stat aggregation note (Phase 2 scope):
 *   We use the stored `battingStats.runs` / `bowlingStats.wickets` career
 *   totals as a proxy for "top performers in this series" rather than
 *   re-aggregating per-match contributions from every Match.scorecard. The
 *   full per-series aggregation is deferred to Phase 3 (will iterate every
 *   completed match's scorecard and sum batting/bowling lines per player
 *   within the series). This gives us correct-ish ordering for any series
 *   whose players have meaningful career stats, and an obvious empty state
 *   for new leagues with no player data.
 */

import { db } from "./db"
import { parseBattingStats, parseBowlingStats, parseScorecard } from "./types"
import type { Innings } from "./types"

/* ------------------------------------------------------------------ */
/* Output types (consumed by the league-homepage.tsx component)        */
/* ------------------------------------------------------------------ */

export interface LeagueInfo {
  id: string
  slug: string
  name: string
  shortName: string
  /** 2-char crest initials (derived from shortName, uppercased). */
  initials: string
  format: string
  season: string
  description: string
  status: string
}

export interface ScoreRow {
  name: string
  score: string
}

export interface RecentResult {
  division: string
  date: string
  teams: [ScoreRow, ScoreRow]
  result: string
}

export interface CentreMatch {
  division: string
  date: string
  status: "live" | "final" | "upcoming"
  statusLabel: string
  teams: [ScoreRow, ScoreRow]
  foot: string
}

export interface StandingRow {
  pos: number
  badge: string
  team: string
  played: number
  won: number
  lost: number
  tied: number
  points: number
  nrr: string
}

export interface PlayerStat {
  initials: string
  name: string
  team: string
  metric: number
}

export interface LeagueArticle {
  id: string
  title: string
  slug: string
  excerpt: string
  imageUrl: string | null
  /** Single primary category (first one if multi-category). */
  category: string
  publishedAt: string
}

export interface GalleryPhoto {
  src: string
  label: string
}

export interface LeagueHomepageData {
  league: LeagueInfo
  recentResults: RecentResult[]
  liveMatches: CentreMatch[]
  upcomingMatches: CentreMatch[]
  standings: StandingRow[]
  topBatsmen: PlayerStat[]
  topBowlers: PlayerStat[]
  topFielders: PlayerStat[]
  articles: LeagueArticle[]
  gallery: GalleryPhoto[]
}

/* ------------------------------------------------------------------ */
/* Small pure helpers                                                  */
/* ------------------------------------------------------------------ */

/** Format a match startDate as a short label like "Oct 29" or "Today 11:00 AM". */
function formatMatchDate(iso: string, status: "live" | "final" | "upcoming"): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""

  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()

  const time = d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase()

  if (status === "live") {
    return sameDay ? `Today ${time}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`
  }
  if (status === "upcoming") {
    if (sameDay) return `Today ${time}`
    if (isTomorrow) return `Tomorrow ${time}`
    // e.g. "Sat 2:00 PM" — weekday + time
    const wd = d.toLocaleDateString("en-US", { weekday: "short" })
    return `${wd} ${time}`
  }
  // completed
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Pull the per-team score string out of a Match's scorecard JSON. */
function formatTeamScore(
  scorecardJson: string | null,
  teamId: string,
  status: "live" | "final" | "upcoming",
  opponentTeamId: string,
): string {
  if (status === "upcoming") return "—"
  const sc = parseScorecard(scorecardJson)
  if (!sc || !sc.innings || sc.innings.length === 0) {
    // No scorecard — for live/completed, show "—" rather than crash.
    return "—"
  }
  const teamInnings = sc.innings.filter((i) => i.teamId === teamId)
  if (teamInnings.length === 0) {
    // Team hasn't batted yet.
    return status === "live" ? "Yet to bat" : "—"
  }

  // For live matches, format the CURRENT innings (last one) with overs in
  // parens; for completed, just join all innings with " & ".
  if (status === "live") {
    const current = teamInnings[teamInnings.length - 1]
    const runs = current.totalRuns ?? 0
    const wkts = current.totalWickets ?? 0
    const overs = (current.totalOvers ?? "").trim()
    return overs ? `${runs}/${wkts} (${overs})` : `${runs}/${wkts}`
  }

  // Completed: join multiple innings (Test) with " & "
  return teamInnings
    .map((i) => {
      const t = (i.total ?? "").trim()
      if (t) return t
      return `${i.totalRuns ?? 0}/${i.totalWickets ?? 0}`
    })
    .join(" & ")
}

/** Derive 2-char crest initials from a shortName, falling back to name. */
function deriveInitials(shortName: string, name: string): string {
  const source = (shortName || name || "").trim()
  if (!source) return "LG"
  // Take first 2 alnum chars, uppercased.
  const matches = source.match(/[A-Za-z0-9]/g)
  if (matches && matches.length >= 2) {
    return (matches[0] + matches[1]).toUpperCase()
  }
  if (matches && matches.length === 1) return matches[0].toUpperCase()
  return "LG"
}

/** Derive 2-char player initials from a full name. */
function derivePlayerInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/)
  if (parts.length === 0) return "??"
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase() || "??"
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Build the per-team short-name badge for the standings table (e.g. "QU"). */
function deriveTeamBadge(shortName: string, name: string): string {
  const s = (shortName || "").trim()
  if (s.length >= 2) return s.slice(0, 2).toUpperCase()
  if (s.length === 1) {
    // Pad with first letter of name.
    const n = (name || "").trim()
    return (s + (n[0] || "")).toUpperCase()
  }
  return deriveInitials(shortName, name)
}

type MatchWithTeams = {
  id: string
  matchNo: string
  status: string
  format: string
  venue: string
  city: string
  startDate: Date
  result: string
  scorecard: string
  team1Id: string
  team2Id: string
  team1: { id: string; name: string; shortName: string }
  team2: { id: string; name: string; shortName: string }
}

/** Build a CentreMatch-shaped object from a Prisma Match row. */
function toCentreMatch(m: MatchWithTeams): CentreMatch {
  const status =
    m.status === "live"
      ? "live"
      : m.status === "completed"
        ? "final"
        : m.status === "abandoned"
          ? "final"
          : "upcoming"
  const statusLabel =
    status === "live" ? "● LIVE" : status === "final" ? "FINAL" : "UPCOMING"

  const t1Score = formatTeamScore(m.scorecard, m.team1Id, status, m.team2Id)
  const t2Score = formatTeamScore(m.scorecard, m.team2Id, status, m.team1Id)

  // Foot text — different per status.
  let foot = ""
  if (status === "final") {
    foot = m.result || `${m.team1.shortName} vs ${m.team2.shortName}`
  } else if (status === "upcoming") {
    const venueParts = [m.venue, m.city].filter(Boolean)
    foot = venueParts.join(" · ") || `${m.team1.shortName} vs ${m.team2.shortName}`
  } else {
    // Live — describe which team is batting.
    const sc = parseScorecard(m.scorecard)
    const currentInn = sc?.innings?.[sc.innings.length - 1]
    if (currentInn) {
      const battingShort =
        currentInn.teamId === m.team1Id ? m.team1.shortName : m.team2.shortName
      const innIdx = sc.innings.findIndex((i) => i === currentInn) + 1
      foot = `${battingShort} batting · ${innIdx}${ordinalSuffix(innIdx)} innings`
    } else {
      foot = `${m.team1.shortName} vs ${m.team2.shortName}`
    }
  }

  return {
    division: m.matchNo || m.format,
    date: formatMatchDate(m.startDate.toISOString(), status),
    status,
    statusLabel,
    teams: [
      { name: m.team1.name, score: t1Score },
      { name: m.team2.name, score: t2Score },
    ],
    foot,
  }
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

/* ------------------------------------------------------------------ */
/* Public query functions                                              */
/* ------------------------------------------------------------------ */

/** Fetch a league (Series) by its slug. Returns null if not found. */
export async function getLeagueBySlug(slug: string) {
  const s = await db.series.findUnique({
    where: { slug },
    include: { tournamentTeams: { include: { team: true } } },
  })
  if (!s) return null
  return s
}

/** Recent completed matches in this league (for the Results ticker). */
export async function getRecentResults(
  seriesId: string,
  limit = 3,
): Promise<RecentResult[]> {
  const matches = await db.match.findMany({
    where: { seriesId, status: "completed" },
    include: { team1: true, team2: true },
    orderBy: { startDate: "desc" },
    take: limit,
  })
  return matches.map((m) => {
    const cm = toCentreMatch(m as unknown as MatchWithTeams)
    return {
      division: cm.division,
      date: cm.date,
      teams: cm.teams,
      result: m.result || `${m.team1.shortName} vs ${m.team2.shortName}`,
    }
  })
}

/** Live matches in this league. */
export async function getLiveMatches(seriesId: string): Promise<CentreMatch[]> {
  const matches = await db.match.findMany({
    where: { seriesId, status: "live" },
    include: { team1: true, team2: true },
    orderBy: { startDate: "asc" },
  })
  return matches.map((m) => toCentreMatch(m as unknown as MatchWithTeams))
}

/** Upcoming fixtures in this league. */
export async function getUpcomingMatches(
  seriesId: string,
  limit = 3,
): Promise<CentreMatch[]> {
  const matches = await db.match.findMany({
    where: { seriesId, status: "upcoming" },
    include: { team1: true, team2: true },
    orderBy: { startDate: "asc" },
    take: limit,
  })
  return matches.map((m) => toCentreMatch(m as unknown as MatchWithTeams))
}

/** Standings for a league, ordered by points desc then NRR desc. */
export async function getStandings(seriesId: string): Promise<StandingRow[]> {
  const rows = await db.standing.findMany({
    where: { seriesId },
    include: { team: true },
    orderBy: [{ points: "desc" }, { nrr: "desc" }],
  })
  return rows.map((row, idx) => ({
    pos: idx + 1,
    badge: deriveTeamBadge(row.team.shortName, row.team.name),
    team: row.team.name,
    played: row.played,
    won: row.won,
    lost: row.lost,
    tied: row.tied,
    points: row.points,
    nrr: (row.nrr >= 0 ? "+" : "") + row.nrr.toFixed(2),
  }))
}

/**
 * Top batsmen in this series — players whose team participates in the series,
 * ranked by career batting runs (Phase 2 stand-in for per-series aggregation).
 */
export async function getTopBatsmen(
  seriesId: string,
  limit = 3,
): Promise<PlayerStat[]> {
  const players = await db.player.findMany({
    where: {
      team: { tournamentTeams: { some: { seriesId } } },
    },
    include: { team: true },
  })
  return players
    .map((p) => {
      const batting = parseBattingStats(p.battingStats)
      return {
        initials: derivePlayerInitials(p.name),
        name: p.name,
        team: p.team.shortName || p.team.name,
        metric: batting.runs,
      }
    })
    .filter((p) => p.metric > 0)
    .sort((a, b) => b.metric - a.metric)
    .slice(0, limit)
}

/** Top bowlers in this series — ranked by career wickets. */
export async function getTopBowlers(
  seriesId: string,
  limit = 3,
): Promise<PlayerStat[]> {
  const players = await db.player.findMany({
    where: {
      team: { tournamentTeams: { some: { seriesId } } },
    },
    include: { team: true },
  })
  return players
    .map((p) => {
      const bowling = parseBowlingStats(p.bowlingStats)
      return {
        initials: derivePlayerInitials(p.name),
        name: p.name,
        team: p.team.shortName || p.team.name,
        metric: bowling?.wickets ?? 0,
      }
    })
    .filter((p) => p.metric > 0)
    .sort((a, b) => b.metric - a.metric)
    .slice(0, limit)
}

/**
 * Top fielders — the schema currently has no fielding-stats model, so this
 * always returns []. Phase 3 will introduce a dismissals aggregate (catches +
 * stumpings) computed from scorecard `dismissal` strings.
 */
export async function getTopFielders(
  _seriesId: string,
  _limit = 3,
): Promise<PlayerStat[]> {
  return []
}

/** Articles associated with a league via the ArticleSeries join. */
export async function getLeagueArticles(
  seriesId: string,
  limit = 3,
): Promise<LeagueArticle[]> {
  const rows = await db.article.findMany({
    where: {
      published: true,
      articleSeries: { some: { seriesId } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  })
  return rows.map((a) => {
    // category is stored as either "news" (legacy) or JSON-array '["news","feature"]'.
    let primaryCat = "news"
    const raw = (a.category || "").trim()
    if (raw.startsWith("[")) {
      try {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length > 0) primaryCat = String(arr[0])
      } catch {
        /* leave as "news" */
      }
    } else if (raw) {
      primaryCat = raw
    }
    return {
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      imageUrl: a.imageUrl,
      category: primaryCat,
      publishedAt: a.publishedAt.toISOString(),
    }
  })
}

/**
 * Gallery photos for the homepage grid — pulls the cover image (or first
 * photo) from the most recently published galleries.
 */
export async function getLeagueGallery(limit = 5): Promise<GalleryPhoto[]> {
  const galleries = await db.gallery.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  const out: GalleryPhoto[] = []
  for (const g of galleries) {
    let photos: { src?: string; caption?: string }[] = []
    try {
      photos = JSON.parse(g.photos || "[]")
    } catch {
      photos = []
    }
    const firstPhoto = photos.find((p) => p && typeof p.src === "string" && p.src)
    const src = firstPhoto?.src || g.coverImage
    if (!src) continue
    out.push({
      src,
      label: g.title || firstPhoto?.caption || "Photo gallery",
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Orchestrator — fetch everything for the homepage in parallel         */
/* ------------------------------------------------------------------ */

/**
 * Fetch all the data needed to render the league homepage. Returns null if
 * no Series matches the slug (caller should `notFound()`).
 *
 * Every sub-query is wrapped in its own try/catch so a single failure (e.g.
 * standings table not yet populated for a new league) doesn't take down the
 * whole page — the corresponding section will render its empty state.
 */
export async function getLeagueHomepageData(
  slug: string,
): Promise<LeagueHomepageData | null> {
  const league = await getLeagueBySlug(slug)
  if (!league) return null

  const seriesId = league.id

  // Fire all sub-queries in parallel. Each catches its own errors so a
  // failure in one section doesn't break the page.
  const [
    recentResults,
    liveMatches,
    upcomingMatches,
    standings,
    topBatsmen,
    topBowlers,
    topFielders,
    articles,
    gallery,
  ] = await Promise.all([
    safe(getRecentResults(seriesId, 3), []),
    safe(getLiveMatches(seriesId), []),
    safe(getUpcomingMatches(seriesId, 3), []),
    safe(getStandings(seriesId), []),
    safe(getTopBatsmen(seriesId, 3), []),
    safe(getTopBowlers(seriesId, 3), []),
    safe(getTopFielders(seriesId, 3), []),
    safe(getLeagueArticles(seriesId, 3), []),
    safe(getLeagueGallery(5), []),
  ])

  return {
    league: {
      id: league.id,
      slug: league.slug,
      name: league.name,
      shortName: league.shortName,
      initials: deriveInitials(league.shortName, league.name),
      format: league.format,
      season: league.season,
      description: league.description,
      status: league.status,
    },
    recentResults,
    liveMatches,
    upcomingMatches,
    standings,
    topBatsmen,
    topBowlers,
    topFielders,
    articles,
    gallery,
  }
}

/** Helper: await a promise, return fallback on rejection. */
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

/** Re-exported for tests / consumers that want to check the raw innings. */
export function _internalParseInnings(scorecardJson: string | null): Innings[] {
  return parseScorecard(scorecardJson)?.innings ?? []
}
