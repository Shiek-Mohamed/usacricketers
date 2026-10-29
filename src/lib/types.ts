// Shared type definitions for the Cricket CMS

export type MatchStatus = "upcoming" | "live" | "completed" | "abandoned"
export type MatchFormat = "Test" | "ODI" | "T20I" | "T10" | "T25" | "T30" | "T35"
export type SeriesStatus = "upcoming" | "ongoing" | "completed"

export interface BattingStat {
  matches: number
  innings: number
  runs: number
  highest: string
  average: number
  strikeRate: number
  hundreds: number
  fifties: number
  fours: number
  sixes: number
  notOuts: number
}

export interface BowlingStat {
  matches: number
  innings: number
  balls: number
  runs: number
  wickets: number
  best: string
  economy: number
  average: number
  strikeRate: number
  maidens: number
}

export interface BattingLine {
  name: string
  playerId?: string
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number
  dismissal: string
  isBatting: boolean
  isCaptain?: boolean
  isKeeper?: boolean
}

export interface BowlingLine {
  name: string
  playerId?: string
  overs: string
  maidens: number
  runs: number
  wickets: number
  economy: number
  wides: number
  noballs: number
  dots?: number
  foursConceded?: number
  sixesConceded?: number
  isBowling: boolean
}

export interface Innings {
  teamId: string
  teamShortName: string
  total: string
  totalRuns: number
  totalWickets: number
  totalOvers: string
  batting: BattingLine[]
  bowling: BowlingLine[]
  fallOfWickets: string[]
  declared: boolean
  extrasBreakdown?: {
    byes: number
    legByes: number
    wides: number
    noBalls: number
  }
  didNotBat?: { name: string; isCaptain?: boolean; isKeeper?: boolean }[]
  partnerships?: string[]
  isFollowOn?: boolean
  isSuperOver?: boolean
}

export interface Scorecard {
  innings: Innings[]
  note: string
  commentary?: { id: string; over: string; text: string; kind: string }[]
}

// API response types mirror Prisma models but with parsed JSON fields
export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  imageUrl: string | null
  imageCaption: string | null
  categories: string[]
  author: string
  tags: string
  featured: boolean
  published: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface Team {
  id: string
  name: string
  shortName: string
  country: string
  primaryColor: string
  accentColor: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Player {
  id: string
  name: string
  teamId: string
  role: string
  isCaptain: boolean
  isKeeper: boolean
  battingStyle: string
  bowlingStyle: string
  battingStats: BattingStat
  bowlingStats: BowlingStat | null
  bio: string
  imageUrl: string
  team?: Team
  createdAt: string
  updatedAt: string
}

export interface Series {
  id: string
  name: string
  shortName: string
  format: string
  season: string
  startDate: string
  endDate: string
  status: string
  description: string
  teams: Team[]
  createdAt: string
  updatedAt: string
}

export interface Match {
  id: string
  seriesId: string | null
  team1Id: string
  team2Id: string
  format: string
  matchNo: string
  status: string
  venue: string
  city: string
  startDate: string
  result: string
  manOfMatch: string | null
  // Match officials — comma-separated on-field umpires + TV umpire + referee.
  umpires: string
  tvUmpire: string
  referee: string
  scorecard: Scorecard | null
  team1?: Team
  team2?: Team
  series?: Series | null
  createdAt: string
  updatedAt: string
}

export type ViewKey =
  | "home"
  | "matches"
  | "match-detail"
  | "news"
  | "article-detail"
  | "interviews"
  | "series"
  | "series-detail"
  | "teams"
  | "team-detail"
  | "players"
  | "player-detail"
  | "player-timeline"
  | "stats"
  | "player-comparison"
  | "schedule"
  | "photos"
  | "gallery-detail"
  | "videos"
  | "video-detail"
  | "search"
  | "admin-dashboard"
  | "admin-login"
  | "admin-reset-password"
  | "admin-articles"
  | "admin-matches"
  | "admin-players"
  | "admin-teams"
  | "admin-series"
  | "admin-sidebar"
  | "admin-import"
  | "admin-galleries"
  | "admin-videos"
  | "admin-banners"
  | "admin-scorers"
  | "admin-league-admins"
  | "live-scorer"
  | "scorer-login"
  | "scorer-landing"
  | "scorer-home"
  | "league-admin-login"
  | "league-admin-signup"
  | "league-admin-home"
  | "league-admin-series-edit"
  | "league-admin-matches"
  | "league-admin-scorers"
  | "admin-import-league"

export interface NavState {
  view: ViewKey
  id: string | null
}

export interface PaginatedArticles {
  items: Article[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SidebarBlock {
  id: string
  title: string
  content: string
  placement: string // "all" or comma-separated page types
  order: number
  published: boolean
  createdAt: string
  updatedAt: string
}

export interface PhotoItem {
  src: string
  caption: string
}

export interface Gallery {
  id: string
  title: string
  slug: string
  description: string
  coverImage: string
  photos: PhotoItem[]
  published: boolean
  createdAt: string
  updatedAt: string
}

export interface Video {
  id: string
  title: string
  slug: string
  description: string
  source: "youtube" | "upload"
  videoUrl: string
  youtubeId: string
  thumbnailUrl: string
  duration: string
  category: string
  author: string
  tags: string
  featured: boolean
  published: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export function parseBattingStats(json: string): BattingStat {
  try {
    const p = JSON.parse(json || "{}")
    return {
      matches: p.matches ?? 0,
      innings: p.innings ?? 0,
      runs: p.runs ?? 0,
      highest: p.highest ?? "0",
      average: p.average ?? 0,
      strikeRate: p.strikeRate ?? 0,
      hundreds: p.hundreds ?? 0,
      fifties: p.fifties ?? 0,
      fours: p.fours ?? 0,
      sixes: p.sixes ?? 0,
      notOuts: p.notOuts ?? 0,
    }
  } catch {
    return { matches: 0, innings: 0, runs: 0, highest: "0", average: 0, strikeRate: 0, hundreds: 0, fifties: 0, fours: 0, sixes: 0, notOuts: 0 }
  }
}

export function parseBowlingStats(json: string | null | undefined): BowlingStat | null {
  if (!json) return null
  try {
    const p = JSON.parse(json || "{}")
    if (!p.wickets && !p.balls) return null
    return {
      matches: p.matches ?? 0,
      innings: p.innings ?? 0,
      balls: p.balls ?? 0,
      runs: p.runs ?? 0,
      wickets: p.wickets ?? 0,
      best: p.best ?? "0/0",
      economy: p.economy ?? 0,
      average: p.average ?? 0,
      strikeRate: p.strikeRate ?? 0,
      maidens: p.maidens ?? 0,
    }
  } catch {
    return null
  }
}

export function parseScorecard(json: string | null | undefined): Scorecard | null {
  if (!json) return null
  try {
    const p = JSON.parse(json)
    if (!p || !p.innings) return null
    return p as Scorecard
  } catch {
    return null
  }
}

/**
 * Parse the Article.category column (a JSON-array string like
 * `["feature","interview"]`) into a string[]. Backward-compatible with old
 * single-string values (e.g. "news" → ["news"]) so pre-migration rows keep
 * working.
 */
export function parseCategories(raw: string | null | undefined): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((s) => typeof s === "string" && s.length > 0)
      }
    } catch {
      /* fall through to single-string handling */
    }
  }
  // Legacy: a bare category string like "news".
  return trimmed ? [trimmed] : []
}

/* ------------------------------ Scorer add-on ------------------------------ */

/** A site administrator account (Tier 1). Full god-mode CMS access. */
export interface SiteAdmin {
  id: string
  email: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/** A scorer account (live-scoring operator). Scoped to tournaments via Series. */
export interface Scorer {
  id: string
  username: string
  email: string | null
  name: string
  active: boolean
  tournamentIds: string[]
  createdAt: string
  updatedAt: string
}

/** Public-facing scorer session returned by the login API (no password hash). */
export interface ScorerSession {
  scorer: {
    id: string
    name: string
    username: string
  }
  token: string
  tournamentIds: string[]
}

/* ------------------------------ League admin ------------------------------ */

/** A league administrator account (Tier 3). Scoped to their own leagues. */
export interface LeagueAdmin {
  id: string
  username: string
  email: string | null
  name: string
  active: boolean
  managedSeriesIds: string[]
  createdAt: string
  updatedAt: string
}

/** Public-facing league-admin session returned by the login API. */
export interface LeagueAdminSession {
  admin: {
    id: string
    name: string
    username: string
  }
  token: string
  managedSeriesIds: string[]
}

/* --------------------------------- Banners -------------------------------- */

export type BannerType = "image" | "adsense" | "html"

export interface Banner {
  id: string
  type: BannerType
  title: string
  placement: string
  order: number
  published: boolean
  startDate: string | null
  endDate: string | null
  impressions: number
  clicks: number
  weight: number

  // type="image"
  imageUrl: string | null
  linkUrl: string | null
  altText: string | null

  // type="adsense"
  adsenseClient: string | null
  adsenseSlot: string | null
  adsenseFormat: string | null
  responsive: boolean

  // type="html"
  htmlContent: string | null

  createdAt: string
  updatedAt: string
}

// ─── League import (Task 11) ────────────────────────────────────────────
// The JSON schema accepted by /api/admin/import-league. Admins upload
// a JSON file matching this shape; the importer parses + loads the data.

export interface ImportedLeague {
  name: string
  shortName?: string
  format?: string // "T20" | "ODI" | "Test" | "T10" — defaults to "T20"
  season?: string // defaults to current year
  startDate?: string // ISO date — defaults to today
  endDate?: string // ISO date — optional
  description?: string // optional
}

export interface ImportedPlayer {
  name: string
  role?: string // defaults to "Batsman"
  isCaptain?: boolean // defaults to false
  isKeeper?: boolean // defaults to false
  battingStyle?: string // defaults to "Right-hand bat"
  bowlingStyle?: string // defaults to ""
  imageUrl?: string // defaults to ""
  bio?: string // defaults to ""
}

export interface ImportedTeam {
  name: string
  shortName: string // 3-6 chars, used as the unique identity within the league
  primaryColor?: string // hex; defaults to "#1e3a8a" (will be overridden to non-blue if possible)
  accentColor?: string // hex; defaults to "#f59e0b"
  country?: string // defaults to ""
  description?: string // defaults to ""
  players?: ImportedPlayer[] // optional — can be empty if only fixtures are being imported
}

export interface ImportedMatch {
  matchNo?: string // defaults to "1st Match"
  format?: string // defaults to the league format
  team1ShortName: string // references ImportedTeam.shortName
  team2ShortName: string
  venue?: string // defaults to ""
  city?: string // defaults to ""
  startDate: string // ISO datetime — required
  status?: string // "upcoming" | "live" | "completed" | "abandoned" — defaults to "upcoming"
  result?: string // free-text result string for completed matches — defaults to ""
  manOfMatch?: string // optional player name
  scorecard?: Scorecard // our native Scorecard JSON for completed matches — optional
}

export interface ImportedLeagueData {
  league: ImportedLeague
  teams: ImportedTeam[]
  matches?: ImportedMatch[] // optional — can import teams-only
}
