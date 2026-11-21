"use client"

import { useEffect, useMemo, useRef } from "react"
import { useAppStore } from "@/lib/store"
import { useMatch } from "@/lib/use-data"
import type { Match } from "@/lib/types"
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
import {
  MatchInfoWidget,
  RecentResultsWidget,
} from "@/components/site/sidebar-widgets"
import { useLiveScore } from "@/lib/use-live-score"
import {
  stateToScorecard,
  oversString,
  type LiveMatchState,
  type ScorerBatsman,
  type ScorerBowler,
} from "@/lib/scoring"
import { useMatches } from "@/lib/use-data"
import {
  Card,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  ChevronLeft,
  MapPin,
  Trophy,
  CalendarDays,
  Info,
  MessageSquare,
  Radio,
  Mic,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ShareButtons } from "@/components/site/share-buttons"
import { SeoMeta } from "@/components/site/seo-meta"

/* -------------------------------------------------------------------------- */
/*  Commentary item — loose type that accepts both liveState entries and      */
/*  the persisted Scorecard.commentary entries (whose `kind` is a plain       */
/*  string). Color-coding below handles every known kind + the new "manual"   */
/*  kind emitted by the human-commentary input in the live-scorer view.       */
/* -------------------------------------------------------------------------- */
interface CommentaryItem {
  id: string
  over: string
  text: string
  kind: string
  audioUrl?: string
}

function MatchHeaderCard({ match }: { match: Match }) {
  const sc = match.scorecard
  const live = match.status === "live"
  const t1 = match.team1
  const t2 = match.team2

  const t1Innings = sc?.innings?.filter((i) => i.teamId === match.team1Id) ?? []
  const t2Innings = sc?.innings?.filter((i) => i.teamId === match.team2Id) ?? []

  // Compute a status summary line (like Wisden's "X leads by N runs...")
  const statusLine = (() => {
    if (match.status === "completed" && match.result) return match.result
    if (match.status === "upcoming") return "Match yet to begin"
    if (!sc || (t1Innings.length === 0 && t2Innings.length === 0)) return "Innings setup in progress"
    // For live matches, compute a lead/chase summary
    const lastInn = sc.innings?.[sc.innings.length - 1]
    if (!lastInn) return "Live — scoring in progress"
    return `Live — ${lastInn.totalRuns}/${lastInn.totalWickets} (${lastInn.totalOvers} ov)`
  })()

  return (
    <div className={`overflow-hidden rounded-xl ${live ? "ring-2 ring-red-500/40" : ""}`}>
      {/* Top bar — format + match no + series on left, status badge on right */}
      <div className="flex items-center justify-between gap-2 bg-[#0f1729] dark:bg-[#0d1525] dark:bg-[#0d1525] px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate text-sm font-bold text-white/90">{match.matchNo}</span>
          <span className="hidden text-xs text-white/50 sm:inline">{match.series?.shortName || match.series?.name || ""}</span>
        </div>
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

      {/* Hero scoreboard — dark navy gradient with symmetric team layout */}
      <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] dark:from-[#1e2a5e] dark:to-[#1a2540] px-4 py-6 sm:px-6 sm:py-8">
        {/* Venue + date — small, centered */}
        <div className="mb-5 text-center text-xs text-white/50">
          {match.venue}{match.city ? `, ${match.city}` : ""} · {formatMatchDate(match.startDate)}
        </div>

        {/* Two teams centered as a group — crests + scores + "vs" */}
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          {/* Team 1 (left) */}
          <TeamHeroSide team={t1} innings={t1Innings} align="left" />

          {/* VS divider */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">vs</div>
          </div>

          {/* Team 2 (right) */}
          <TeamHeroSide team={t2} innings={t2Innings} align="right" />
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

      {/* Status strip — lighter shade, one-line summary */}
      <div className="bg-[#162244] dark:bg-[#1a2540] dark:bg-[#1a2540] px-4 py-2.5 text-center sm:px-6">
        <p className="text-sm font-semibold text-white/90">{statusLine}</p>
      </div>
    </div>
  )
}

/** One team's side of the hero scoreboard — crest + name + score. */
function TeamHeroSide({
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
      {/* Crest in a white circle */}
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 ring-2 ring-white/20 sm:h-14 sm:w-14">
        <TeamBadge team={team} size="md" />
      </div>
      {/* Team short name */}
      <div className="text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm">
        {team.shortName}
      </div>
      {/* Score — massive numerals */}
      {hasScore ? (
        <div className="text-white">
          {innings.map((inn, i) => (
            <div key={i} className="text-2xl font-extrabold tabular-nums sm:text-4xl">
              {inn.totalRuns}/{inn.totalWickets}
            </div>
          ))}
          <div className="text-xs font-normal text-white/50">
            ({innings[0].totalOvers} ov)
          </div>
        </div>
      ) : (
        <div className="text-sm text-white/40">Yet to bat</div>
      )}
    </a>
  )
}

function MatchDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Card className="overflow-hidden p-0">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="grid gap-4 p-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-6 w-3/4 mx-6" />
      </Card>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Live tab sub-components                                                   */
/* -------------------------------------------------------------------------- */

/** A small colored pill for one ball in the recent-balls strip.
 *  Color coding (ESPNcricinfo-ish):
 *    dot=gray · 1-3 runs=green · 4=blue · 6=purple · W=red · wide/noball=amber
 */
function ballPillStyle(entry: CommentaryItem): {
  cls: string
  label: string
} {
  const k = entry.kind
  if (k === "wicket") return { cls: "bg-red-600 text-white", label: "W" }
  if (k === "six") return { cls: "bg-purple-600 text-white", label: "6" }
  if (k === "boundary") return { cls: "bg-sky-600 text-white", label: "4" }
  if (k === "extra") {
    // Distinguish wide vs noball from the text when possible.
    const t = entry.text.toLowerCase()
    if (t.includes("wide")) return { cls: "bg-amber-500 text-amber-950", label: "wd" }
    if (t.includes("no ball")) return { cls: "bg-amber-500 text-amber-950", label: "nb" }
    return { cls: "bg-amber-500 text-amber-950", label: "+" }
  }
  if (k === "run") {
    // Extract the run count from text like "3 runs — Smith"
    const m = entry.text.match(/^(\d+)/)
    const r = m ? Number(m[1]) : 0
    return { cls: "bg-emerald-600 text-white", label: String(r) }
  }
  if (k === "dot") return { cls: "bg-muted text-muted-foreground", label: "•" }
  // Manual / info / over end / unknown — render as a subtle gray dot.
  return { cls: "bg-muted text-muted-foreground", label: "•" }
}

/** Recent balls strip — shows the last 6 ball-events as colored pills.
 *  Uses the liveState.commentary feed (which is already newest-first) so
 *  we can pick out the most recent deliveries with their proper kinds. */
function RecentBallsStrip({
  commentary,
}: {
  commentary: CommentaryItem[]
}) {
  // Pick only ball-event kinds — skip "info", "over" (end-of-over markers)
  // and "manual" (commentator notes). These 6 kinds cover every legal
  // delivery + extras.
  const ballKinds = new Set(["run", "boundary", "six", "wicket", "extra", "dot"])
  const recent = commentary.filter((c) => ballKinds.has(c.kind)).slice(0, 6)

  if (recent.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="text-[10px] font-bold uppercase tracking-wide">This over</span>
        <span>No balls bowled yet</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Recent
      </span>
      <div className="flex items-center gap-1.5">
        {/* Reverse so the most-recent ball sits on the right (reading order
            matches the natural "left→right = older→newer" of an over). */}
        {[...recent].reverse().map((entry, i) => {
          const { cls, label } = ballPillStyle(entry)
          return (
            <span
              key={entry.id + i}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold tabular-nums",
                cls
              )}
              title={`${entry.over} · ${entry.text}`}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Live batsmen + bowler strip. Mirrors the operator's LiveScoreboard
 *  but stripped down for the public view (no swap/change controls). */
function LiveBattingStrip({
  state,
}: {
  state: LiveMatchState
}) {
  const inn = state.innings[state.currentInnings]
  if (!inn) return null
  const striker = inn.batsmen.find((b) => b.id === state.strikerId)
  const nonStriker = inn.batsmen.find((b) => b.id === state.nonStrikerId)
  const bowler = inn.bowlers.find((b) => b.id === state.bowlerId)

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <BatsmanCard batsman={striker} striker />
        <BatsmanCard batsman={nonStriker} />
      </div>
      {bowler && <BowlerCard bowler={bowler} />}
    </div>
  )
}

function BatsmanCard({
  batsman,
  striker,
}: {
  batsman?: ScorerBatsman
  striker?: boolean
}) {
  if (!batsman) {
    return (
      <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
        No batsman
      </div>
    )
  }
  const sr = batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(1) : "0.0"
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        striker ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30" : "bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {striker && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
            <span
              className={cn(
                "truncate text-sm",
                striker ? "font-extrabold text-emerald-700 dark:text-emerald-300" : "font-semibold"
              )}
            >
              {batsman.name}
            </span>
            {striker && (
              <span className="rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                Strike
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-lg font-extrabold tabular-nums">{batsman.runs}</span>
          <span className="ml-1 text-xs text-muted-foreground">({batsman.balls})</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>4s <span className="font-semibold text-foreground">{batsman.fours}</span></span>
        <span>6s <span className="font-semibold text-foreground">{batsman.sixes}</span></span>
        <span>SR <span className="font-semibold text-foreground tabular-nums">{sr}</span></span>
      </div>
    </div>
  )
}

function BowlerCard({ bowler }: { bowler: ScorerBowler }) {
  const econ = bowler.balls > 0 ? ((bowler.runsConceded / bowler.balls) * 6).toFixed(2) : "0.00"
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="truncate text-sm font-semibold">{bowler.name}</span>
            <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Bowling
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-sm font-extrabold tabular-nums">
            {oversString(bowler.balls)}-{bowler.maidens}-{bowler.runsConceded}-{bowler.wickets}
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>Overs <span className="font-semibold text-foreground tabular-nums">{oversString(bowler.balls)}</span></span>
        <span>Maidens <span className="font-semibold text-foreground">{bowler.maidens}</span></span>
        <span>Runs <span className="font-semibold text-foreground">{bowler.runsConceded}</span></span>
        <span>Wkts <span className="font-semibold text-foreground">{bowler.wickets}</span></span>
        <span>Econ <span className="font-semibold text-foreground tabular-nums">{econ}</span></span>
      </div>
    </div>
  )
}

/** Compact score + partnership + RRR summary bar at the top of the Live tab. */
function LiveSummaryBar({ state }: { state: LiveMatchState }) {
  const inn = state.innings[state.currentInnings]
  if (!inn) return null
  const overs = oversString(inn.balls)
  const crr = inn.balls > 0 ? (inn.runs / inn.balls * 6).toFixed(2) : "0.00"
  // Partnership runs = current total − runs on the board when this
  // partnership began. Balls faced = current balls − balls then.
  const pRuns = Math.max(0, inn.runs - inn.partnershipStartRuns)
  const pBalls = Math.max(0, inn.balls - inn.partnershipStartBalls)
  const target = inn.target
  const ballsLeft = state.maxOvers > 0 ? state.maxOvers * 6 - inn.balls : null
  const runsNeeded = target ? target - inn.runs : null
  const rrr =
    target && ballsLeft && ballsLeft > 0
      ? ((runsNeeded! / ballsLeft) * 6).toFixed(2)
      : null

  return (
    <div className="rounded-lg border bg-gradient-to-br from-slate-900 to-slate-800 p-3 text-white sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {inn.battingTeamShortName} · Innings {state.currentInnings + 1}
            {inn.target ? ` · target ${inn.target}` : ""}
          </div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl">
            {inn.runs}/{inn.wickets}
            <span className="ml-2 text-base font-normal text-slate-300">
              ({overs} ov)
            </span>
            {inn.freeHit && (
              <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-950 animate-pulse">
                Free hit
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-slate-300">
          <div>CRR <span className="font-bold text-white tabular-nums">{crr}</span></div>
          {rrr && (
            <div>
              RRR <span className="font-bold text-white tabular-nums">{rrr}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-2 text-xs text-slate-300">
        <span>
          Partnership:{" "}
          <span className="font-bold text-white tabular-nums">{pRuns} ({pBalls})</span>
        </span>
        {target && runsNeeded !== null && ballsLeft !== null && ballsLeft > 0 ? (
          <span>
            Need <span className="font-bold text-amber-300 tabular-nums">{runsNeeded}</span> from{" "}
            <span className="font-bold text-white tabular-nums">{ballsLeft}</span> balls · RRR{" "}
            <span className="font-bold text-white tabular-nums">{rrr}</span>
          </span>
        ) : target && runsNeeded !== null && runsNeeded <= 0 ? (
          <span className="font-bold text-emerald-300">Target reached</span>
        ) : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Commentary feed (public) — newest at top, grouped by over, color-coded.    */
/* -------------------------------------------------------------------------- */

/** Color-class helper for a commentary entry. Returns Tailwind classes for
 *  the over badge + the text. Manual entries get a blue treatment so they
 *  stand out from auto-generated ball-by-ball commentary. */
function commentaryColors(kind: string): {
  badge: string
  text: string
  border?: string
} {
  switch (kind) {
    case "wicket":
      return { badge: "bg-red-600 text-white", text: "font-semibold text-red-700 dark:text-red-300" }
    case "six":
      return { badge: "bg-purple-600 text-white", text: "font-semibold text-purple-700 dark:text-purple-300" }
    case "boundary":
      return { badge: "bg-sky-600 text-white", text: "font-semibold text-sky-700 dark:text-sky-300" }
    case "extra":
      return { badge: "bg-amber-500 text-amber-950", text: "text-amber-700 dark:text-amber-300" }
    case "run":
      return { badge: "bg-emerald-600 text-white", text: "text-emerald-700 dark:text-emerald-300" }
    case "dot":
      return { badge: "bg-muted text-muted-foreground", text: "text-muted-foreground" }
    case "over":
      return { badge: "bg-slate-700 text-white", text: "font-semibold text-foreground" }
    case "info":
      return { badge: "bg-muted text-muted-foreground", text: "italic text-muted-foreground" }
    case "manual":
      // Commentator entry — blue accent + left border to distinguish
      return {
        badge: "bg-sky-600 text-white",
        text: "text-foreground",
        border: "border-l-2 border-sky-500 pl-2",
      }
    case "ai":
      // AI-generated prose — neutral slate badge + italic text so it reads
      // as narrative rather than a stat line. AUGMENTS the templated feed
      // (the structured ball entry it describes sits directly above it).
      return {
        badge: "bg-slate-700 text-white",
        text: "italic text-foreground/80",
      }
    default:
      return { badge: "bg-muted text-muted-foreground", text: "text-foreground" }
  }
}

/** Group commentary by over, preserving the newest-first order inside
 *  each over. Returns an array of { over, entries } blocks sorted so
 *  the most recent over appears first. */
function groupByOver(commentary: CommentaryItem[]): {
  over: string
  entries: CommentaryItem[]
}[] {
  const groups = new Map<string, CommentaryItem[]>()
  for (const entry of commentary) {
    // Use the integer part of the over string ("12.3" → "12", "12" → "12").
    // The "over" entry at end-of-over has over like "12" (no decimal).
    const overNum = entry.over.split(".")[0] ?? "0"
    const key = overNum
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(entry)
  }
  // Sort group keys numerically descending (newest over first).
  const sorted = [...groups.entries()].sort((a, b) => {
    const an = parseInt(a[0], 10) || 0
    const bn = parseInt(b[0], 10) || 0
    return bn - an
  })
  return sorted.map(([over, entries]) => ({ over, entries }))
}

function CommentaryFeed({
  commentary,
}: {
  commentary: CommentaryItem[]
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Track the latest entry id so we know when "new" entries arrive.
  const latestId = commentary[0]?.id ?? ""

  // Auto-scroll to top (newest entry) when new entries arrive. The feed
  // renders newest-first, so "scroll to top" means showing the freshest
  // commentary — exactly what ESPNcricinfo does.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
  }, [latestId])

  if (commentary.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-extrabold uppercase tracking-wide">
            Commentary
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center px-3 py-10 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">No commentary yet</p>
          <p className="text-xs text-muted-foreground/80">
            Ball-by-ball updates will appear here once scoring begins.
          </p>
        </div>
      </div>
    )
  }

  const grouped = groupByOver(commentary)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-red-600" />
          <h3 className="text-xs font-extrabold uppercase tracking-wide">
            Live Commentary
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {commentary.length} entries · newest first
        </span>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[500px] overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
      >
        {grouped.map((group) => (
          <div key={group.over} className="mb-3 last:mb-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Over {group.over}
              </span>
              <span className="h-px flex-1 bg-border/60" />
            </div>
            <div className="space-y-1.5">
              {group.entries.map((entry) => {
                const colors = commentaryColors(entry.kind)
                const isManual = entry.kind === "manual"
                const isAi = entry.kind === "ai"
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex gap-2 text-sm",
                      colors.border
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums",
                        colors.badge
                      )}
                    >
                      {entry.over}
                    </span>
                    <span className={cn("min-w-0 flex-1 leading-snug", colors.text)}>
                      {isManual && (
                        <span className="mr-1 inline-block rounded bg-sky-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white align-middle">
                          Commentator
                        </span>
                      )}
                      {isAi && (
                        <span className="mr-1 inline-block rounded bg-slate-700 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white align-middle">
                          AI
                        </span>
                      )}
                      {entry.text.startsWith("[audio:") ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400">
                            <Mic className="h-3 w-3" />
                            Voice commentary
                          </span>
                          <audio
                            src={entry.text.match(/\[audio:(.+?)\]/)?.[1]}
                            controls
                            className="h-8"
                          />
                        </span>
                      ) : (
                        <>
                          {entry.text}
                          {isAi && entry.audioUrl && (
                            <audio
                              controls
                              src={entry.audioUrl}
                              preload="none"
                              className="mt-1 h-7 w-full max-w-[240px]"
                            />
                          )}
                        </>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main view                                                                  */
/* -------------------------------------------------------------------------- */

export function MatchDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data, loading, error } = useMatch(id)
  const { data: allMatches } = useMatches()
  const { liveState, connected } = useLiveScore(id)

  // Default to the Live tab when the match is live, otherwise Scorecard.
  // Controlled so the user can switch freely; defaultValue only kicks in
  // on first mount (keyed on the match id so navigating between matches
  // re-evaluates the default).
  const isLiveLiveState = liveState?.status === "live"
  const defaultTab = isLiveLiveState ? "live" : "scorecard"

  // Commentary source: prefer the live feed, fall back to the persisted
  // scorecard's commentary array (for completed matches).
  const commentary: CommentaryItem[] = useMemo(() => {
    if (liveState?.commentary?.length) {
      return liveState.commentary.map((c) => ({
        id: c.id,
        over: c.over,
        text: c.text,
        kind: c.kind,
        audioUrl: c.audioUrl,
      }))
    }
    return []
  }, [liveState])

  if (loading) return <MatchDetailSkeleton />

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("matches")}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to matches
        </Button>
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Unable to load match</AlertTitle>
          <AlertDescription>
            {error || "Match not found. It may have been removed."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const match = data
  // When a live scoring session is broadcasting, prefer the live scorecard +
  // status over the persisted DB copy so this public view updates instantly.
  const match_ = liveState
    ? {
        ...match,
        scorecard: stateToScorecard(liveState),
        status: liveState.status,
        result: liveState.result || match.result,
      }
    : match
  const sc = match_.scorecard
  const isLive = match_.status === "live"

  // Merge in the persisted scorecard's commentary when there's no live
  // feed (completed matches) — this is what powers the Commentary section
  // for finished games. (Plain derivation — no useMemo, since `sc` here
  // is only available after the early-return guards above; calling a hook
  // now would violate the Rules of Hooks.)
  const persistedCommentary: CommentaryItem[] = (() => {
    const c = sc?.commentary
    if (!c || c.length === 0) return []
    return c.map((x) => ({
      id: x.id,
      over: x.over,
      text: x.text,
      kind: x.kind,
      audioUrl: x.audioUrl,
    }))
  })()

  const effectiveCommentary =
    commentary.length > 0 ? commentary : persistedCommentary

  return (
    <>
    <SeoMeta
      title={`${match_.team1?.shortName ?? "?"} vs ${match_.team2?.shortName ?? "?"} — ${match_.matchNo}`}
      description={`${match_.format} match at ${match_.venue || "TBD"}${match_.result ? ` — ${match_.result}` : ""}`}
      image={`${typeof window !== "undefined" ? window.location.origin : ""}/api/og-image?match=${match_.id}`}
      type="website"
      url={typeof window !== "undefined" ? `${window.location.origin}/?view=match-detail&id=${match_.id}` : undefined}
    />
    <InnerPageLayout
      sidebar={
        <>
          <MatchInfoWidget match={match_} />
          <RecentResultsWidget matches={allMatches ?? []} />
          <CustomSidebarBlocks placement="match" />
        </>
      }
    >
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("matches")}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to matches
        </Button>

        <MatchHeaderCard match={match_} />

        {isLive && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-red-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-red-700">
              Live scoring in progress
            </span>
            {connected && (
              <span className="text-xs text-red-600/80">· connected</span>
            )}
            <span className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updates in real time as balls are scored
              </span>
              {/* Live Blog button — opens the immersive ball-by-ball feed */}
              <Button
                size="sm"
                onClick={() => navigate("live-blog", match_.id)}
                className="gap-1.5 bg-red-600 text-xs font-bold text-white hover:bg-red-700"
              >
                <Radio className="h-3.5 w-3.5" />
                Live Blog
              </Button>
            </span>
          </div>
        )}

        {match_.status === "completed" && match_.result && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <Trophy className="h-4 w-4" /> Result
              </div>
              <ShareButtons title={`${match_.team1?.shortName} vs ${match_.team2?.shortName} — ${match_.matchNo}`} />
            </div>
            <p className="mt-1 text-sm font-semibold">{match_.result}</p>
            {match_.manOfMatch && (
              <p className="mt-1 text-sm text-emerald-700">
                <span className="font-bold">Player of the Match:</span> {match_.manOfMatch}
              </p>
            )}
            {/* Match officials — umpires + TV umpire + referee */}
            {(match_.umpires || match_.tvUmpire || match_.referee) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {match_.umpires && (
                  <span>
                    <span className="font-semibold">Umpires:</span>{" "}
                    {match_.umpires}
                  </span>
                )}
                {match_.tvUmpire && (
                  <span>
                    <span className="font-semibold">TV:</span>{" "}
                    {match_.tvUmpire}
                  </span>
                )}
                {match_.referee && (
                  <span>
                    <span className="font-semibold">Referee:</span>{" "}
                    {match_.referee}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabbed layout — segmented pill bar (Wisden-style) */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex w-full gap-1 rounded-full bg-muted p-1 sm:w-auto">
            <TabsTrigger
              value="live"
              className="gap-1.5 rounded-full data-[state=active]:bg-[#1e2a5e] data-[state=active]:text-white data-[state=active]:shadow-sm"
              disabled={!isLive && effectiveCommentary.length === 0}
            >
              <Radio className="h-3.5 w-3.5" />
              Commentary
            </TabsTrigger>
            <TabsTrigger
              value="scorecard"
              className="gap-1.5 rounded-full data-[state=active]:bg-[#1e2a5e] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Scorecard
            </TabsTrigger>
          </TabsList>

          {/* ----- Live tab ----- */}
          <TabsContent value="live" className="mt-4 space-y-4">
            {liveState && liveState.innings.length > 0 ? (
              <>
                {/* Score + partnership + RRR summary */}
                <LiveSummaryBar state={liveState} />

                {/* Recent balls + batsmen/bowler strips side-by-side on sm+ */}
                <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
                  <RecentBallsStrip commentary={effectiveCommentary} />
                  <div className="sm:min-w-0">
                    <LiveBattingStrip state={liveState} />
                  </div>
                </div>

                {/* Commentary feed */}
                <CommentaryFeed commentary={effectiveCommentary} />
              </>
            ) : (
              <Card className="grid place-items-center p-6 text-center">
                <div className="space-y-1">
                  <Radio className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-semibold">Match not yet live</p>
                  <p className="text-xs text-muted-foreground">
                    {isLive
                      ? "Innings setup is in progress — live feed will appear here shortly."
                      : "Live commentary is only available during scoring."}
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ----- Scorecard tab ----- */}
          <TabsContent value="scorecard" className="mt-4">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-red-600" />
                <h2 className="text-sm font-extrabold uppercase tracking-tight sm:text-base">
                  Full Scorecard
                </h2>
              </div>
              {sc ? (
                <ScorecardView scorecard={sc} />
              ) : (
                <Card className="grid place-items-center p-6">
                  <p className="text-sm text-muted-foreground">
                    Scorecard will be available once the match begins.
                  </p>
                </Card>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </InnerPageLayout>
    </>
  )
}
