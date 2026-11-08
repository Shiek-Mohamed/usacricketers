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
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
      <div className="flex items-center justify-between gap-2 bg-[#0f1729] px-4 py-2 sm:px-6">
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
      <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] px-4 py-6 sm:px-6 sm:py-8">
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
      <div className="bg-[#162244] px-4 py-2.5 text-center sm:px-6">
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
  // Parse "Bowler — description" format, or use the text as-is
  const parts = entry.text.split("—")
  const heading = parts[0]?.trim() || ""
  const description = parts.slice(1).join("—").trim() || entry.text

  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
      {/* Ball number circle + over.ball notation */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        {isBall ? (
          <BallChip kind={entry.kind} text={entry.text} size="md" />
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
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
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
/*  Coming Soon placeholder for WinViz / Graphs                                */
/* -------------------------------------------------------------------------- */

function ComingSoon({ title, icon: Icon, description }: { title: string; icon: React.ElementType; description: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <h3 className="font-display text-sm font-bold uppercase tracking-wide">{title}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
    </Card>
  )
}

export function MatchPageContent({ match, recent }: { match: Match; recent: Match[] }) {
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
              <MatchScorebox match={match} />
              {/* 6-tab Wisden-style layout — solid block active tabs */}
              <Tabs defaultValue="commentary" className="w-full">
                <TabsList className="flex w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
                  <TabsTrigger value="commentary" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    <MessageSquare className="h-4 w-4" />
                    Commentary
                  </TabsTrigger>
                  <TabsTrigger value="squads" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    <Users className="h-4 w-4" />
                    Squads
                  </TabsTrigger>
                  <TabsTrigger value="scorecard" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    Scorecard
                  </TabsTrigger>
                  <TabsTrigger value="winviz" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    <TrendingUp className="h-4 w-4" />
                    WinViz
                  </TabsTrigger>
                  <TabsTrigger value="graphs" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    <BarChart3 className="h-4 w-4" />
                    Graphs
                  </TabsTrigger>
                  <TabsTrigger value="info" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    <Info className="h-4 w-4" />
                    Match Info
                  </TabsTrigger>
                </TabsList>

                {/* Commentary tab — over-by-over accordion with ball chips */}
                <TabsContent value="commentary" className="mt-4">
                  {match.scorecard?.commentary?.length ? (
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

                {/* WinViz tab — coming soon */}
                <TabsContent value="winviz" className="mt-4">
                  <ComingSoon
                    title="WinViz"
                    icon={TrendingUp}
                    description="Win probability visualization — coming soon. This will show real-time win probability for each team based on the match situation."
                  />
                </TabsContent>

                {/* Graphs tab — coming soon */}
                <TabsContent value="graphs" className="mt-4">
                  <ComingSoon
                    title="Graphs"
                    icon={BarChart3}
                    description="Run rate worms, partnership charts, and scoring visualizations — coming soon."
                  />
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
