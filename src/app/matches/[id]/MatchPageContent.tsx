"use client"

import { useState } from "react"
import type { Match, Scorecard } from "@/lib/types"
import {
  TeamBadge,
  StatusPill,
  FormatPill,
  formatMatchDate,
  formatMatchTime,
} from "@/components/cricket/ui"
import { ScorecardView } from "@/components/cricket/scorecard"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { RecentResultsWidget } from "@/components/site/sidebar-widgets"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { ShareButtons } from "@/components/site/share-buttons"
import { LiveMatchSection } from "@/components/site/live-match-section"
import {
  LiveScoreBanner,
  ThisOverTracker,
  RecentOversStrip,
  CurrentPartnership,
  EnhancedCommentaryFeed,
} from "@/components/cricket/live-match-enhancements"
import { useLiveScore } from "@/lib/use-live-score"
import { stateToScorecard, type LiveMatchState } from "@/lib/scoring"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { FallOfWicketsChart } from "@/components/cricket/fall-of-wickets-chart"
import { OverComparisonChart } from "@/components/cricket/over-comparison-chart"
import { cn } from "@/lib/utils"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, Cell, ResponsiveContainer, CartesianGrid } from "recharts"
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  CalendarDays,
  Home as HomeIcon,
  Trophy,
  Users,
  User,
  Shield,
  Award,
  Info,
  MessageSquare,
  BarChart3,
  TrendingUp,
  CloudRain,
  Radio,
} from "lucide-react"

function MatchBreadcrumbs({ match }: { match: Match }) {
  const t1 = match.team1?.shortName ?? "Team 1"
  const t2 = match.team2?.shortName ?? "Team 2"
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <a href="/" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
        <HomeIcon className="h-3 w-3" /> Home
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <a href="/?view=matches" className="transition-colors hover:text-foreground">Matches</a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <span className="line-clamp-1 max-w-[60%] truncate font-medium text-foreground/80">{t1} vs {t2}</span>
    </nav>
  )
}

/** Detail row helper */
function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  )
}

/** Full match scorebox — Wisden-inspired dark navy gradient hero with
 *  symmetric team layout, big score numerals, "vs" divider, and a
 *  one-line status strip at the bottom. Match details go in a compact
 *  horizontal strip below the hero. */
function MatchScorebox({ match }: { match: Match }) {
  const sc = match.scorecard
  const live = match.status === "live"
  const t1 = match.team1
  const t2 = match.team2
  const t1Innings = sc?.innings?.filter((i) => i.teamId === match.team1Id) ?? []
  const t2Innings = sc?.innings?.filter((i) => i.teamId === match.team2Id) ?? []

  const statusLine = (() => {
    if (match.status === "completed" && match.result) return match.result
    if (match.status === "upcoming") return "Match yet to begin"
    if (!sc || (t1Innings.length === 0 && t2Innings.length === 0)) return "Innings setup in progress"
    const lastInn = sc.innings?.[sc.innings.length - 1]
    if (!lastInn) return "Live — scoring in progress"
    return `Live — ${lastInn.totalRuns}/${lastInn.totalWickets} (${lastInn.totalOvers} ov)`
  })()

  return (
    <div className={`overflow-hidden rounded-xl ${live ? "ring-2 ring-red-500/40" : ""}`}>
      {/* Top bar — format + match no + share + status */}
      <div className="flex items-center justify-between gap-2 bg-[#0f1729] dark:bg-[#0d1525] px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate font-display text-sm font-bold uppercase tracking-wide text-white/90">{match.matchNo}</span>
          {match.series?.shortName && (
            <span className="hidden font-display text-xs font-medium uppercase tracking-wide text-white/50 sm:inline">· {match.series.shortName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ShareButtons title={`${t1?.shortName ?? "?"} vs ${t2?.shortName ?? "?"} — ${match.matchNo}`} className="flex" />
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live
            </span>
          ) : (
            <StatusPill status={match.status} />
          )}
        </div>
      </div>

      {/* Hero scoreboard — dark navy gradient with symmetric team layout */}
      <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] px-4 py-6 sm:px-6 sm:py-8">
        {/* Venue + date — small, centered */}
        <div className="mb-5 text-center text-xs text-white/50">
          {match.venue}{match.city ? `, ${match.city}` : ""} · {formatMatchDate(match.startDate)}
        </div>

        {/* Two teams centered as a group — crests + scores + "vs" */}
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          {/* Team 1 (left) */}
          <ScoreHeroSide team={t1} innings={t1Innings} align="left" />

          {/* VS divider */}
          <div className="text-xs font-bold uppercase tracking-widest text-white/30">vs</div>

          {/* Team 2 (right) */}
          <ScoreHeroSide team={t2} innings={t2Innings} align="right" />
        </div>

        {/* Toss info */}
        {match.tossWinnerId && match.tossDecision && (() => {
          const winner = match.tossWinnerId === match.team1Id ? match.team1 : match.tossWinnerId === match.team2Id ? match.team2 : undefined
          if (!winner) return null
          return (
            <div className="mt-5 text-center text-xs font-medium text-white/60">
              {winner.name} won the toss and elected to {match.tossDecision === "bat" ? "bat" : "bowl"}
            </div>
          )
        })()}
      </div>

      {/* Status strip — one-line summary */}
      <div className="bg-[#162244] dark:bg-[#1a2540] px-4 py-2.5 text-center sm:px-6">
        <p className="text-sm font-semibold text-white/90">{statusLine}</p>
      </div>

      {/* Match details — compact horizontal strip below the hero */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 bg-muted/20 px-4 py-2.5 text-xs sm:px-6">
        {match.series?.name && (
          <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-muted-foreground" /> {match.series.name}</span>
        )}
        {match.series?.season && (
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> {match.series.season}</span>
        )}
        {match.manOfMatch && (
          <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-muted-foreground" /> POTM: {match.manOfMatch}</span>
        )}
        {match.umpires && (
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Umpires: {match.umpires}</span>
        )}
        {match.tvUmpire && (
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" /> TV: {match.tvUmpire}</span>
        )}
        {match.referee && (
          <span className="inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-muted-foreground" /> Referee: {match.referee}</span>
        )}
      </div>
    </div>
  )
}

/** One team's side of the hero scoreboard — crest + short name + score. */
function ScoreHeroSide({
  team,
  innings,
  align,
}: {
  team?: Match["team1"]
  innings: { totalRuns: number; totalWickets: number; totalOvers: string }[]
  align: "left" | "right"
}) {
  if (!team) return <div />
  const hasScore = innings.length > 0
  return (
    <a
      href={`/teams/${team.id}`}
      className={`flex flex-col gap-2 ${align === "left" ? "items-start text-left" : "items-end text-right"}`}
    >
      {/* Crest in a translucent circle */}
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 ring-2 ring-white/20 sm:h-14 sm:w-14">
        <TeamBadge team={team} size="md" />
      </div>
      {/* Team short name */}
      <div className="font-display text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm">
        {team.shortName}
      </div>
      {/* Score — massive numerals */}
      {hasScore ? (
        <div className="text-white">
          {innings.map((inn, i) => (
            <div key={i} className="font-display text-2xl font-extrabold tabular-nums sm:text-4xl">
              {inn.totalRuns}<span className="text-white/60">/{inn.totalWickets}</span>
            </div>
          ))}
          <div className="font-display text-xs font-normal text-white/50">
            ({innings[0].totalOvers} ov)
          </div>
        </div>
      ) : (
        <div className="font-display text-sm text-white/40">Yet to bat</div>
      )}
    </a>
  )
}

/* -------------------------------------------------------------------------- */
/*  Ball chip — Wisden-style color-coded circles                               */
/*  dot=dark gray · 1-3=white w/ border · 4=blue · 6=magenta · W=red           */
/* -------------------------------------------------------------------------- */

function BallChip({ kind, text, size = "sm" }: { kind: string; text: string; size?: "sm" | "md" }) {
  // All chips use the SAME dimensions regardless of ball type — consistency
  const dim = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs"
  const base = `grid ${dim} shrink-0 place-items-center rounded-full font-bold`
  if (kind === "wicket") return <span className={`${base} bg-red-600 text-white`}>W</span>
  if (kind === "six") return <span className={`${base} bg-fuchsia-600 text-white`}>6</span>
  if (kind === "boundary") return <span className={`${base} bg-sky-600 text-white`}>4</span>
  if (kind === "extra") {
    const t = text.toLowerCase()
    const label = t.includes("wide") ? "wd" : t.includes("no ball") ? "nb" : "+"
    return <span className={`${base} bg-amber-500 text-amber-950`}>{label}</span>
  }
  if (kind === "run") {
    const m = text.match(/^(\d+)/)
    const r = m ? m[1] : "0"
    return <span className={`${base} border border-gray-300 bg-white text-gray-700`}>{r}</span>
  }
  // Dot ball — same size, gray fill with center dot
  return <span className={`${base} bg-gray-200`}><span className="h-1.5 w-1.5 rounded-full bg-gray-500" /></span>
}

/* -------------------------------------------------------------------------- */
/*  Commentary accordion — Wisden-style over-by-over blocks                    */
/* --------------------------------------------------------------------------- */

function CommentaryAccordion({ scorecard, match }: { scorecard: Scorecard; match: Match }) {
  const commentary = scorecard.commentary ?? []
  if (commentary.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No commentary available for this match.
      </Card>
    )
  }

  // Build innings selector pills (if multiple innings)
  const inningsLabels = scorecard.innings.map((inn, i) => ({
    key: `inn-${i}`,
    label: `${inn.teamShortName} Inns ${scorecard.innings.filter((x) => x.teamId === inn.teamId).indexOf(inn) + 1}`,
    teamId: inn.teamId,
  }))

  // Group commentary by over number. Newest first.
  // Skip over 0 — those are pre-match info messages ("innings begins"),
  // not actual overs. Cricket overs start from 1.
  const ballKinds = new Set(["run", "boundary", "six", "wicket", "extra", "dot"])
  const overMap = new Map<number, typeof commentary>()
  for (const c of commentary) {
    const overNum = parseInt(c.over?.split(".")[0] || "0", 10)
    if (overNum < 1) continue // skip info/pre-match entries
    if (!overMap.has(overNum)) overMap.set(overNum, [])
    overMap.get(overNum)!.push(c)
  }
  const overs = Array.from(overMap.keys()).sort((a, b) => b - a)

  return (
    <div className="space-y-3">
      {/* Innings selector pills */}
      {inningsLabels.length > 1 && (
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {inningsLabels.map((inn, i) => (
            <button
              key={inn.key}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                i === 0 ? "bg-[#1e2a5e] text-white" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {inn.label}
            </button>
          ))}
        </div>
      )}

      {/* Over blocks */}
      <div className="overflow-hidden rounded-lg border border-border/60">
        {overs.map((overNum) => {
          const entries = overMap.get(overNum)!
          const balls = entries.filter((e) => ballKinds.has(e.kind))
          const runsInOver = balls.reduce((sum, b) => {
            const m = b.text.match(/^(\d+)/)
            return sum + (m ? Number(m[1]) : 0)
          }, 0)
          const hasWicket = balls.some((b) => b.kind === "wicket")
          const bowler = entries.find((e) => e.text.includes("—"))?.text.split("—")[1]?.trim()?.split("  ")[0] ?? ""

          return (
            <OverBlock
              key={overNum}
              overNum={overNum}
              entries={entries}
              balls={balls}
              runsInOver={runsInOver}
              hasWicket={hasWicket}
              bowler={bowler}
              isLast={overNum === overs[overs.length - 1]}
            />
          )
        })}
      </div>
    </div>
  )
}

function OverBlock({
  overNum,
  entries,
  balls,
  runsInOver,
  hasWicket,
  bowler,
  isLast,
}: {
  overNum: number
  entries: { id: string; over: string; text: string; kind: string }[]
  balls: { id: string; over: string; text: string; kind: string }[]
  runsInOver: number
  hasWicket: boolean
  bowler: string
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`bg-card ${!isLast ? "border-b border-border/40" : ""}`}>
      {/* Over header — title row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-4 pt-3 text-left"
      >
        <span className="font-display text-base font-bold tabular-nums text-foreground">Over {overNum}</span>
        <div className="flex items-center gap-2">
          {/* Summary text */}
          <span className="text-sm text-muted-foreground">
            {runsInOver > 0 && `${runsInOver} run${runsInOver > 1 ? "s" : ""}`}
            {hasWicket && runsInOver > 0 && " · "}
            {hasWicket && <span className="font-bold text-red-600">W</span>}
            {bowler && ` · ${bowler}`}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Ball chips row — below the title */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 pb-3 pt-2 text-left"
      >
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {balls.slice(0, 8).map((b) => (
            <BallChip key={b.id} kind={b.kind} text={b.text} />
          ))}
        </div>
      </button>

      {/* Expanded — per-ball commentary cards (Wisden style) */}
      {expanded && (
        <div className="space-y-2 px-4 pb-4">
          {entries.map((e) => (
            <BallCommentaryCard key={e.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  )
}

function BallCommentaryCard({ entry }: { entry: { id: string; over: string; text: string; kind: string } }) {
  const ballKinds = new Set(["run", "boundary", "six", "wicket", "extra", "dot"])
  const isBall = ballKinds.has(entry.kind)
  const isMilestone = entry.kind === "milestone"
  // Parse "Bowler — description" format, or use the text as-is
  const parts = entry.text.split("—")
  const heading = parts[0]?.trim() || ""
  const description = parts.slice(1).join("—").trim() || entry.text

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg p-3",
        isMilestone ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/50",
      )}
    >
      {/* Ball number circle + over.ball notation */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        {isBall ? (
          <BallChip kind={entry.kind} text={entry.text} size="md" />
        ) : isMilestone ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
            <Trophy className="h-4 w-4" />
          </span>
        ) : (
          <div className="h-9 w-9 shrink-0" />
        )}
        <span className="text-xs font-medium text-muted-foreground">{entry.over}</span>
      </div>
      {/* Commentary text */}
      <div className="min-w-0 flex-1 pt-1">
        {heading && (
          <p className="text-sm font-bold text-foreground">{heading}</p>
        )}
        <p
          className={cn(
            "mt-0.5 text-sm",
            isMilestone
              ? "font-bold text-amber-700 dark:text-amber-300"
              : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Squads — both teams' playing XIs from the scorecard                        */
/* -------------------------------------------------------------------------- */

function SquadsView({ match, scorecard }: { match: Match; scorecard: Scorecard }) {
  const t1Innings = scorecard.innings.filter((i) => i.teamId === match.team1Id)
  const t2Innings = scorecard.innings.filter((i) => i.teamId === match.team2Id)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SquadCard title={match.team1?.name ?? "Team 1"} shortName={match.team1?.shortName} innings={t1Innings} />
      <SquadCard title={match.team2?.name ?? "Team 2"} shortName={match.team2?.shortName} innings={t2Innings} />
    </div>
  )
}

function SquadCard({
  title,
  shortName,
  innings,
}: {
  title: string
  shortName?: string
  innings: Scorecard["innings"]
}) {
  const played = innings.flatMap((inn) => inn.batting.map((b) => b.name))
  const didNotBat = innings.flatMap((inn) => inn.didNotBat ?? [])
  const all = [...played, ...didNotBat.map((d) => d.name)]
  const deduped = [...new Set(all)]

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          {shortName && <span className="text-emerald-600">{shortName} </span>}
          {title}
        </h3>
      </div>
      <div className="divide-y divide-border/40">
        {deduped.length > 0 ? (
          deduped.map((name, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
              <span className="text-sm font-medium text-foreground">{name}</span>
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Squad not available</p>
        )}
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Match Info — venue, date, series, weather, toss                            */
/* -------------------------------------------------------------------------- */

function MatchInfoView({ match }: { match: Match }) {
  const tossWinner = match.tossWinnerId === match.team1Id ? match.team1 : match.tossWinnerId === match.team2Id ? match.team2 : undefined
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
          <Info className="h-4 w-4 text-emerald-600" /> Match Information
        </h3>
      </div>
      <div className="divide-y divide-border/40">
        <InfoRow icon={MapPin} label="Venue" value={match.venue ? `${match.venue}${match.city ? `, ${match.city}` : ""}` : null} />
        <InfoRow icon={CalendarDays} label="Date & Time" value={`${formatMatchDate(match.startDate)} · ${formatMatchTime(match.startDate)}`} />
        <InfoRow icon={Trophy} label="Series" value={match.series?.name} />
        <InfoRow icon={CloudRain} label="Weather" value={match.weather} />
        {tossWinner && match.tossDecision && (
          <InfoRow icon={Trophy} label="Toss" value={`${tossWinner.name} won the toss and elected to ${match.tossDecision === "bat" ? "bat" : "bowl"}`} />
        )}
      </div>
    </Card>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      <span className="w-36 shrink-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Match Preview — recent form + head-to-head for upcoming matches            */
/* -------------------------------------------------------------------------- */

function MatchPreview({ match, recent }: { match: Match; recent: Match[] }) {
  const t1 = match.team1
  const t2 = match.team2

  // Compute recent form (last 5 completed matches for each team)
  function getForm(teamId: string): { result: "W" | "L" | "T" | "N"; match: Match }[] {
    return recent
      .filter((m) => m.status === "completed" && (m.team1Id === teamId || m.team2Id === teamId))
      .slice(0, 5)
      .map((m) => {
        const isTeam1 = m.team1Id === teamId
        const team = isTeam1 ? m.team1 : m.team2
        const opp = isTeam1 ? m.team2 : m.team1
        const result = (m.result || "").toLowerCase()
        if (result.includes("tie") || result.includes("tied")) return { result: "T" as const, match: m }
        if (!result) return { result: "N" as const, match: m }
        const won = result.includes(team?.shortName?.toLowerCase() ?? "___") ||
                    result.includes(team?.name?.toLowerCase() ?? "___")
        return { result: won ? "W" as const : "L" as const, match: m }
      })
  }

  const t1Form = getForm(match.team1Id)
  const t2Form = getForm(match.team2Id)

  // Head-to-head: matches between these two teams
  const h2h = recent.filter((m) =>
    m.status === "completed" &&
    ((m.team1Id === match.team1Id && m.team2Id === match.team2Id) ||
     (m.team1Id === match.team2Id && m.team2Id === match.team1Id))
  )
  const t1Wins = h2h.filter((m) => {
    const r = (m.result || "").toLowerCase()
    return r.includes(t1?.shortName?.toLowerCase() ?? "___") || r.includes(t1?.name?.toLowerCase() ?? "___")
  }).length
  const t2Wins = h2h.filter((m) => {
    const r = (m.result || "").toLowerCase()
    return r.includes(t2?.shortName?.toLowerCase() ?? "___") || r.includes(t2?.name?.toLowerCase() ?? "___")
  }).length

  if (t1Form.length === 0 && t2Form.length === 0) return null

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
          <Trophy className="h-4 w-4 text-emerald-600" /> Match Preview
        </h3>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border/40">
        {/* Team 1 form */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            {t1 && <TeamBadge team={t1} size="sm" />}
            <span className="font-display text-sm font-bold">{t1?.shortName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {t1Form.length > 0 ? (
              t1Form.map((f, i) => (
                <span
                  key={i}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded text-xs font-bold",
                    f.result === "W" && "bg-emerald-600 text-white",
                    f.result === "L" && "bg-red-500 text-white",
                    f.result === "T" && "bg-amber-500 text-white",
                    f.result === "N" && "bg-muted text-muted-foreground",
                  )}
                >
                  {f.result}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No recent matches</span>
            )}
          </div>
        </div>
        {/* Team 2 form */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            {t2 && <TeamBadge team={t2} size="sm" />}
            <span className="font-display text-sm font-bold">{t2?.shortName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {t2Form.length > 0 ? (
              t2Form.map((f, i) => (
                <span
                  key={i}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded text-xs font-bold",
                    f.result === "W" && "bg-emerald-600 text-white",
                    f.result === "L" && "bg-red-500 text-white",
                    f.result === "T" && "bg-amber-500 text-white",
                    f.result === "N" && "bg-muted text-muted-foreground",
                  )}
                >
                  {f.result}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No recent matches</span>
            )}
          </div>
        </div>
      </div>
      {/* Head-to-head */}
      {h2h.length > 0 && (
        <div className="border-t px-4 py-3 text-center">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Head-to-Head: </span>
          <span className="text-sm font-bold text-emerald-600">{t1?.shortName} {t1Wins}</span>
          <span className="text-sm text-muted-foreground"> — </span>
          <span className="text-sm font-bold text-red-500">{t2Wins} {t2?.shortName}</span>
          <span className="text-xs text-muted-foreground"> ({h2h.length} matches)</span>
        </div>
      )}
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  WinViz — win probability bar based on current match state                   */
/* -------------------------------------------------------------------------- */

function WinVizView({ match, scorecard, liveState }: { match: Match; scorecard?: Scorecard | null; liveState?: LiveMatchState | null }) {
  // Prefer the explicitly-passed scorecard (live-derived when broadcasting)
  // over the persisted snapshot so the win-probability bar updates in near
  // real-time as balls are scored. Falls back to match.scorecard for
  // completed/upcoming matches with no live state.
  const sc = scorecard ?? match.scorecard
  const t1 = match.team1
  const t2 = match.team2

  // The persisted row can lag behind the broadcast — when the live state has
  // already completed with a result, prefer it so a finished chase resolves
  // to 100% immediately instead of showing stale chase numbers.
  const effectiveMatch: Match =
    liveState && liveState.status === "completed" && liveState.result
      ? { ...match, status: liveState.status, result: liveState.result }
      : match

  // DLS-aware chase — when the scorer applied a revised target, the model
  // must chase that target over the revised overs, not the original ones.
  const dls =
    liveState?.dlsTarget && liveState.dlsTarget > 0
      ? { targetOverride: liveState.dlsTarget, revisedOvers: liveState.dlsRevisedOvers ?? null }
      : undefined

  // Compute win probability from the match state
  const probs = computeWinProbability(effectiveMatch, sc, dls)

  if (!probs) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">WinViz</h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          Win probability will appear here once the match is live or completed.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b bg-muted/30 px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Win Probability
          </h3>
        </div>
        <div className="p-4">
          {/* Probability bar */}
          <div className="flex h-12 overflow-hidden rounded-lg">
            {probs.t1 > 0 && (
              <div
                className="flex items-center justify-center transition-all duration-500"
                style={{ width: `${probs.t1}%`, background: t1?.primaryColor || "#1e2a5e" }}
              >
                <span className="text-sm font-bold text-white">{probs.t1}%</span>
              </div>
            )}
            {probs.draw > 0 && (
              <div
                className="flex items-center justify-center bg-muted transition-all duration-500"
                style={{ width: `${probs.draw}%` }}
              >
                <span className="text-sm font-bold text-muted-foreground">{probs.draw}%</span>
              </div>
            )}
            {probs.t2 > 0 && (
              <div
                className="flex items-center justify-center transition-all duration-500"
                style={{ width: `${probs.t2}%`, background: t2?.primaryColor || "#94a3b8" }}
              >
                <span className="text-sm font-bold text-white">{probs.t2}%</span>
              </div>
            )}
          </div>
          {/* Team labels */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: t1?.primaryColor || "#1e2a5e" }} />
              <span className="text-sm font-bold">{t1?.shortName}</span>
            </div>
            {probs.draw > 0 && (
              <span className="text-xs text-muted-foreground">Draw</span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold">{t2?.shortName}</span>
              <span className="h-3 w-3 rounded-full" style={{ background: t2?.primaryColor || "#94a3b8" }} />
            </div>
          </div>
        </div>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Win probability is calculated from the current match situation — runs scored, wickets remaining, and overs left. It updates as the match progresses.
      </p>
    </div>
  )
}

/** Simplified win probability model based on match state. */
function computeWinProbability(
  match: Match,
  sc: Scorecard | null,
  dls?: { targetOverride?: number; revisedOvers?: number | null },
):
  | { t1: number; t2: number; draw: number }
  | null {
  if (!sc || sc.innings.length === 0) return null
  if (match.status === "completed" && match.result) {
    // Completed match — assign 100% to the winner
    if (match.result.includes(match.team1?.shortName ?? "___") && !match.result.includes("tie")) {
      return { t1: 100, t2: 0, draw: 0 }
    }
    if (match.result.includes(match.team2?.shortName ?? "___") && !match.result.includes("tie")) {
      return { t1: 0, t2: 100, draw: 0 }
    }
    return { t1: 50, t2: 50, draw: 0 } // tie/no result
  }

  const isTest = match.format === "Test"
  const innings = sc.innings
  const lastInn = innings[innings.length - 1]
  const firstInn = innings[0]

  if (innings.length === 1) {
    // 1st innings in progress — roughly 50/50 with slight edge to batting team
    const runs = lastInn.totalRuns
    const wickets = lastInn.totalWickets
    const overs = parseFloat(lastInn.totalOvers) || 0
    const maxOvers = match.format === "T20" || match.format === "T20I" ? 20 : match.format === "ODI" || match.format === "ODI" ? 50 : 90
    // Simple heuristic: more runs + fewer wickets = better position
    const progress = overs / maxOvers // 0 to 1
    const wicketPenalty = wickets * 8 // each wicket costs ~8% confidence
    const runBonus = Math.min(runs / (maxOvers * 5), 1) * 20 // strong total gives bonus
    const battingAdvantage = Math.max(0, Math.min(25, runBonus - wicketPenalty * progress))
    const drawChance = isTest ? Math.max(5, 40 - overs * 0.4) : 0
    const remaining = 100 - drawChance
    const battingTeam = lastInn.teamId === match.team1Id ? "t1" : "t2"
    const battingProb = remaining / 2 + battingAdvantage
    const bowlingProb = remaining - battingProb
    if (battingTeam === "t1") return { t1: Math.round(battingProb), t2: Math.round(bowlingProb), draw: Math.round(drawChance) }
    return { t1: Math.round(bowlingProb), t2: Math.round(battingProb), draw: Math.round(drawChance) }
  }

  if (innings.length >= 2) {
    // 2nd innings — chasing team's probability based on target + wickets + balls left
    // A DLS-revised chase replaces the original target and the overs on offer.
    const target = dls?.targetOverride ?? (firstInn.totalRuns ?? 0) + 1
    const chasingRuns = lastInn.totalRuns
    const chasingWickets = lastInn.totalWickets
    const chasingOvers = parseFloat(lastInn.totalOvers) || 0
    const maxOvers = match.format === "T20" || match.format === "T20I" ? 20 : match.format === "ODI" || match.format === "ODI" ? 50 : 90
    const effectiveMaxOvers = dls?.revisedOvers && dls.revisedOvers > 0 ? dls.revisedOvers : maxOvers
    const ballsRemaining = Math.max(0, (effectiveMaxOvers - chasingOvers) * 6)
    const runsNeeded = target - chasingRuns
    const wicketsInHand = 10 - chasingWickets

    if (runsNeeded <= 0) {
      // Chase complete — chasing team wins
      const chaser = lastInn.teamId === match.team1Id ? "t1" : "t2"
      return chaser === "t1" ? { t1: 100, t2: 0, draw: 0 } : { t1: 0, t2: 100, draw: 0 }
    }
    if (ballsRemaining <= 0 || wicketsInHand <= 0) {
      // Can't chase — batting team (first innings) wins
      const firstTeam = firstInn.teamId === match.team1Id ? "t1" : "t2"
      return firstTeam === "t1" ? { t1: 100, t2: 0, draw: isTest ? 0 : 0 } : { t1: 0, t2: 100, draw: 0 }
    }

    const requiredRR = (runsNeeded / ballsRemaining) * 6
    const currentRR = chasingOvers > 0 ? chasingRuns / chasingOvers : 0
    // Win probability: based on RRR vs CRR + wickets in hand
    const rrRatio = currentRR > 0 ? requiredRR / currentRR : 2
    const chaseProb = Math.max(0, Math.min(100,
      (wicketsInHand / 10) * 60 + (1 / rrRatio) * 40
    ))
    const drawChance = isTest ? Math.max(0, 30 - innings.length * 10) : 0
    const remaining = 100 - drawChance
    const chaser = lastInn.teamId === match.team1Id ? "t1" : "t2"
    const chaserProb = Math.round(chaseProb * remaining / 100)
    const setterProb = remaining - chaserProb
    if (chaser === "t1") return { t1: chaserProb, t2: setterProb, draw: Math.round(drawChance) }
    return { t1: setterProb, t2: chaserProb, draw: Math.round(drawChance) }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/*  Graphs — Run Rate Worm (Manhattan chart)                                   */
/* --------------------------------------------------------------------------- */

function GraphsView({ match, scorecard }: { match: Match; scorecard?: Scorecard | null }) {
  // Prefer the explicitly-passed scorecard (live-derived when broadcasting)
  // so the worms + new charts update in near real-time. Falls back to the
  // persisted snapshot when there's no live state.
  const sc = scorecard ?? match.scorecard
  if (!sc || sc.innings.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">Graphs</h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          Graphs will appear here once the match begins and overs are bowled.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cumulative Run Worm — both teams on one chart */}
      {sc.innings.length >= 2 && (
        <CumulativeRunWorm match={match} scorecard={sc} />
      )}

      {/* Over Comparison — grouped bars of runs per over, one series per team */}
      <OverComparisonChart match={match} scorecard={sc} />

      {/* Fall of Wickets — cumulative score at each wicket, one line per innings */}
      <FallOfWicketsChart match={match} scorecard={sc} />

      {/* Per-innings Run Rate Worms (Manhattan) */}
      {sc.innings.map((inn, i) => {
        const team = inn.teamId === match.team1Id ? match.team1 : match.team2
        return (
          <RunRateWorm
            key={i}
            innings={inn}
            teamName={team?.name ?? "Team"}
            teamShort={team?.shortName ?? ""}
            teamColor={team?.primaryColor ?? "#1e2a5e"}
            commentary={sc.commentary ?? []}
            teamId={inn.teamId}
          />
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Cumulative Run Worm — both teams' progress on one chart                    */
/* --------------------------------------------------------------------------- */

function CumulativeRunWorm({ match, scorecard }: { match: Match; scorecard: Scorecard }) {
  const t1 = match.team1
  const t2 = match.team2
  const t1Color = t1?.primaryColor ?? "#1e2a5e"
  const t2Color = t2?.primaryColor ?? "#94a3b8"

  // Compute cumulative runs per over for each team
  const ballKinds = new Set(["run", "boundary", "six", "wicket", "extra", "dot"])

  function cumulativeForTeam(teamId: string): Map<number, number> {
    const overRuns = new Map<number, number>()
    for (const c of scorecard.commentary ?? []) {
      const overNum = parseInt(c.over?.split(".")[0] || "0", 10)
      if (overNum < 1) continue
      if (!ballKinds.has(c.kind)) continue
      // Check if this ball belongs to this team's innings
      const inn = scorecard.innings.find((i) => i.teamId === teamId)
      if (!inn) continue
      const m = c.text.match(/^(\d+)/)
      const runs = m ? Number(m[1]) : 0
      overRuns.set(overNum, (overRuns.get(overNum) ?? 0) + runs)
    }
    // Convert to cumulative
    let cum = 0
    const cumulative = new Map<number, number>()
    const sorted = Array.from(overRuns.keys()).sort((a, b) => a - b)
    for (const over of sorted) {
      cum += overRuns.get(over) ?? 0
      cumulative.set(over, cum)
    }
    return cumulative
  }

  const t1Data = cumulativeForTeam(match.team1Id)
  const t2Data = cumulativeForTeam(match.team2Id)

  // Merge into a single dataset keyed by over number
  const allOvers = Array.from(new Set([...t1Data.keys(), ...t2Data.keys()])).sort((a, b) => a - b)
  const data = allOvers.map((over) => ({
    over: `${over}`,
    [match.team1Id]: t1Data.get(over) ?? null,
    [match.team2Id]: t2Data.get(over) ?? null,
  }))

  if (data.length === 0) {
    return null
  }

  const chartConfig: ChartConfig = {
    [match.team1Id]: { label: t1?.shortName ?? "Team 1", color: t1Color },
    [match.team2Id]: { label: t2?.shortName ?? "Team 2", color: t2Color },
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
          <BarChart3 className="h-4 w-4 text-emerald-600" />
          Cumulative Run Worm
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t1?.shortName} vs {t2?.shortName} — cumulative runs per over
        </p>
      </div>
      <div className="p-4">
        {/* Legend */}
        <div className="mb-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-full" style={{ background: t1Color }} />
            <span className="text-sm font-bold">{t1?.shortName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-full" style={{ background: t2Color }} />
            <span className="text-sm font-bold">{t2?.shortName}</span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="over"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              label={{ value: "Overs", position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "#9ca3af" } }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              label={{ value: "Runs", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#9ca3af" } }}
            />
            <Line
              type="monotone"
              dataKey={match.team1Id}
              stroke={t1Color}
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey={match.team2Id}
              stroke={t2Color}
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </div>
    </Card>
  )
}

function RunRateWorm({
  innings,
  teamName,
  teamShort,
  teamColor,
  commentary,
  teamId,
}: {
  innings: Scorecard["innings"][0]
  teamName: string
  teamShort: string
  teamColor: string
  commentary: { id: string; over: string; text: string; kind: string }[]
  teamId: string
}) {
  // Compute runs per over from commentary data
  const ballKinds = new Set(["run", "boundary", "six", "wicket", "extra", "dot"])
  const overRuns = new Map<number, number>()

  for (const c of commentary) {
    const overNum = parseInt(c.over?.split(".")[0] || "0", 10)
    if (overNum < 1) continue
    if (!ballKinds.has(c.kind)) continue
    const m = c.text.match(/^(\d+)/)
    const runs = m ? Number(m[1]) : 0
    overRuns.set(overNum, (overRuns.get(overNum) ?? 0) + runs)
  }

  const data = Array.from(overRuns.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([over, runs]) => ({ over: `Ov ${over}`, runs }))

  if (data.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No over-by-over data available for {teamName} yet.
      </Card>
    )
  }

  const chartConfig: ChartConfig = {
    runs: { label: "Runs", color: teamColor },
  }

  // Color bars: wicket overs in red, maiden (0 runs) in gray, else team color
  const maxRuns = Math.max(...data.map((d) => d.runs), 6)

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
          <BarChart3 className="h-4 w-4 text-emerald-600" />
          {teamShort} — Run Rate Worm
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {teamName} · {innings.totalRuns}/{innings.totalWickets} ({innings.totalOvers} ov)
        </p>
      </div>
      <div className="p-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} margin={{ top: 16, right: 16, bottom: 16, left: 0 }} barCategoryGap="20%" barGap={4}>
            <XAxis
              dataKey="over"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              domain={[0, maxRuns]}
              width={32}
            />
            <Bar dataKey="runs" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.runs === 0 ? "#d1d5db" : teamColor}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </Card>
  )
}

export function MatchPageContent({ match, recent }: { match: Match; recent: Match[] }) {
  // Subscribe to the live scoring WebSocket (read-only — no scorer token).
  // When a scorer is broadcasting, liveState is populated and we render the
  // ESPNcricinfo-style live center (banner + this over + recent overs +
  // partnership + enhanced commentary). When no live state, we fall back to
  // the static MatchScorebox + CommentaryAccordion for completed/upcoming.
  const { liveState } = useLiveScore(match.id, null)
  const currentInnings = liveState?.innings[liveState?.currentInnings ?? 0]
  // Show the live center as soon as the scorer has initialized an innings —
  // the enhancement sub-components (this over, partnership, recent overs)
  // gracefully render nothing until their data arrives.
  const hasLiveState = Boolean(liveState && currentInnings)

  // Live-derived scorecard — when a scorer is broadcasting, derive a fresh
  // Scorecard from the live state so WinViz + the Graphs tab update in near
  // real-time as balls are scored. Falls back to the persisted snapshot when
  // there's no live state (completed / upcoming matches).
  const displayScorecard: Scorecard | null = liveState
    ? stateToScorecard(liveState)
    : match.scorecard

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <InnerPageLayout
            sidebar={
              <>
                {recent.length > 0 && <RecentResultsWidget matches={recent} />}
                <CustomSidebarBlocks placement="match" />
              </>
            }
          >
            <div className="space-y-4">
              <MatchBreadcrumbs match={match} />

              {/* ─── LIVE: ESPNcricinfo-style hero + enhancement strips ─── */}
              {hasLiveState && liveState ? (
                <>
                  <LiveScoreBanner match={match} liveState={liveState} />

                  {/* This Over tracker + Current partnership — side by side on desktop */}
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <ThisOverTracker liveState={liveState} />
                    <CurrentPartnership liveState={liveState} />
                  </div>

                  {/* Recent overs — full-width horizontal strip */}
                  <RecentOversStrip liveState={liveState} />
                </>
              ) : (
                /* ─── STATIC: original scorebox for completed/upcoming ─── */
                <MatchScorebox match={match} />
              )}

              {/* Match Preview — shown only for upcoming matches */}
              {match.status === "upcoming" && recent.length > 0 && (
                <MatchPreview match={match} recent={recent} />
              )}

              {/* 6-tab layout — solid block active tabs */}
              <Tabs defaultValue="commentary" className="w-full">
                <TabsList className="flex w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
                  <TabsTrigger value="commentary" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                    {hasLiveState ? <Radio className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    Commentary
                  </TabsTrigger>
                  <TabsTrigger value="squads" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                    <Users className="h-4 w-4" />
                    Squads
                  </TabsTrigger>
                  <TabsTrigger value="scorecard" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                    Scorecard
                  </TabsTrigger>
                  <TabsTrigger value="winviz" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                    <TrendingUp className="h-4 w-4" />
                    WinViz
                  </TabsTrigger>
                  <TabsTrigger value="graphs" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                    <BarChart3 className="h-4 w-4" />
                    Graphs
                  </TabsTrigger>
                  <TabsTrigger value="info" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                    <Info className="h-4 w-4" />
                    Match Info
                  </TabsTrigger>
                </TabsList>

                {/* Commentary tab — LIVE feed when broadcasting, else static accordion */}
                <TabsContent value="commentary" className="mt-4">
                  {hasLiveState && liveState ? (
                    <EnhancedCommentaryFeed liveState={liveState} />
                  ) : match.scorecard?.commentary?.length ? (
                    <CommentaryAccordion scorecard={match.scorecard} match={match} />
                  ) : match.scorecard ? (
                    <Card className="p-6 text-center text-sm text-muted-foreground">
                      No commentary available for this match.
                    </Card>
                  ) : (
                    <Card className="p-6 text-center text-sm text-muted-foreground">
                      Commentary will be available once the match begins.
                    </Card>
                  )}
                </TabsContent>

                {/* Squads tab */}
                <TabsContent value="squads" className="mt-4">
                  {match.scorecard ? (
                    <SquadsView match={match} scorecard={match.scorecard} />
                  ) : (
                    <Card className="p-6 text-center text-sm text-muted-foreground">
                      Squads will be available once the match begins.
                    </Card>
                  )}
                </TabsContent>

                {/* Scorecard tab */}
                <TabsContent value="scorecard" className="mt-4">
                  {match.scorecard ? (
                    <ScorecardView scorecard={match.scorecard} />
                  ) : (
                    <Card className="p-6 text-center text-sm text-muted-foreground">
                      Scorecard not yet available for this match.
                    </Card>
                  )}
                </TabsContent>

                {/* WinViz tab — win probability */}
                <TabsContent value="winviz" className="mt-4">
                  <WinVizView match={match} scorecard={displayScorecard} liveState={liveState} />
                </TabsContent>

                {/* Graphs tab — run rate worm */}
                <TabsContent value="graphs" className="mt-4">
                  <GraphsView match={match} scorecard={displayScorecard} />
                </TabsContent>

                {/* Match Info tab */}
                <TabsContent value="info" className="mt-4">
                  <MatchInfoView match={match} />
                </TabsContent>
              </Tabs>

              {recent.length > 0 && (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <CalendarDays className="h-4 w-4 text-emerald-600" /> Recent Results
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recent.slice(0, 6).map((m) => (
                      <a key={m.id} href={`/matches/${m.id}`} className="group flex flex-col rounded-lg border bg-card p-3 transition-shadow hover:shadow-md">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold">{m.team1?.shortName} v {m.team2?.shortName}</span>
                          <FormatPill format={m.format} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs">{m.result || formatMatchDate(m.startDate)}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <a href="/?view=matches" className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" /> More matches
              </a>
            </div>
          </InnerPageLayout>
        </div>
      </main>
      <Footer />
    </div>
  )
}
