"use client"

import { useMemo } from "react"
import type { LiveMatchState, CommentaryEntry, ScorerInnings } from "@/lib/scoring"
import { oversString } from "@/lib/scoring"
import type { Match } from "@/lib/types"
import { TeamBadge } from "@/components/cricket/ui"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { calculateDLS } from "@/lib/dls"
import {
  Radio,
  TrendingUp,
  Target,
  Zap,
  Users,
  Activity,
  Trophy,
} from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Kinds that represent actual deliveries (used to filter commentary). */
const BALL_KINDS = new Set(["run", "boundary", "six", "wicket", "extra", "dot"])

/** Compute the runs contributed by a single commentary ball entry. */
function runsFromBall(entry: CommentaryEntry): number {
  switch (entry.kind) {
    case "boundary":
      return 4
    case "six":
      return 6
    case "wicket":
      return 0
    case "dot":
      return 0
    case "run": {
      const m = entry.text.match(/^(\d+)/)
      return m ? Number(m[1]) : 0
    }
    case "extra": {
      // "Wide (+1)", "No ball (+1)", "Bye 1", "Leg bye 2"
      const plus = entry.text.match(/\(\+(\d+)\)/)
      if (plus) return Number(plus[1])
      const m = entry.text.match(/(\d+)/)
      return m ? Number(m[1]) : 1
    }
    default:
      return 0
  }
}

/** Parse the over number from an entry's `over` string ("14.3" -> 14). */
function overNumberOf(entry: CommentaryEntry): number {
  return parseInt(entry.over?.split(".")[0] || "0", 10)
}

/** Ordinal suffix helper — 1 -> "1st", 2 -> "2nd", 3 -> "3rd". */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/* -------------------------------------------------------------------------- */
/*  This Over — colored circle for a single ball                              */
/*  ESPNcricinfo ribbon: dot=dark gray, 1-3=green, 4=blue, 6=purple,         */
/*  W=red, wide/nb=amber, empty=light gray outline.                          */
/* -------------------------------------------------------------------------- */

interface BallCircleProps {
  entry?: CommentaryEntry
  /** Show an empty placeholder circle (ball not yet bowled). */
  empty?: boolean
  size?: "sm" | "md"
}

function ThisOverBall({ entry, empty, size = "md" }: BallCircleProps) {
  const dim = size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]"
  const base = cn(
    "grid shrink-0 place-items-center rounded-full font-display font-bold tabular-nums leading-none transition-transform",
    dim,
  )

  if (empty || !entry) {
    return (
      <span
        className={cn(
          base,
          "border-2 border-dashed border-muted-foreground/30 text-transparent",
        )}
        aria-label="Ball not yet bowled"
      >
        &bull;
      </span>
    )
  }

  switch (entry.kind) {
    case "wicket":
      return <span className={cn(base, "bg-red-600 text-white")}>W</span>
    case "six":
      return <span className={cn(base, "bg-purple-600 text-white")}>6</span>
    case "boundary":
      return <span className={cn(base, "bg-sky-600 text-white")}>4</span>
    case "milestone":
      return (
        <span className={cn(base, "bg-amber-500 text-white")}>
          <Trophy className="h-3 w-3" />
        </span>
      )
    case "dot":
      return (
        <span className={cn(base, "bg-gray-700 text-white")}>
          <span className="text-base leading-none">&bull;</span>
        </span>
      )
    case "run": {
      const m = entry.text.match(/^(\d+)/)
      const r = m ? m[1] : "0"
      return <span className={cn(base, "bg-emerald-600 text-white")}>{r}</span>
    }
    case "extra": {
      const t = entry.text.toLowerCase()
      const label = t.startsWith("wide")
        ? "wd"
        : t.startsWith("no ball")
          ? "nb"
          : t.startsWith("leg bye")
            ? "lb"
            : t.startsWith("bye")
              ? "b"
              : "+"
      return <span className={cn(base, "bg-amber-500 text-amber-950")}>{label}</span>
    }
    default:
      return (
        <span className={cn(base, "border-2 border-dashed border-muted-foreground/30")}>
          &bull;
        </span>
      )
  }
}

/** Extract the balls of the over currently being bowled (or just completed).
 *  Commentary is newest-first; we look at the most recent ball entry to find
 *  the current over number, then collect all balls of that over in chronological
 *  order. Returns up to 6 entries; missing slots are rendered as empty circles. */
function getCurrentOverBalls(commentary: CommentaryEntry[]): CommentaryEntry[] {
  // Find the most recent actual ball
  let mostRecentBall: CommentaryEntry | undefined
  for (const c of commentary) {
    if (BALL_KINDS.has(c.kind)) {
      mostRecentBall = c
      break
    }
  }
  if (!mostRecentBall) return []
  const overNum = overNumberOf(mostRecentBall)
  if (overNum < 1) return []

  // Collect all balls of this over (oldest first for display)
  const balls = commentary.filter(
    (c) => BALL_KINDS.has(c.kind) && overNumberOf(c) === overNum,
  )
  return balls.reverse()
}

/** This Over tracker — the ESPNcricinfo-style ribbon of colored circles. */
export function ThisOverTracker({ liveState }: { liveState: LiveMatchState }) {
  const innings = liveState.innings[liveState.currentInnings]
  const commentary = liveState.commentary ?? []
  const balls = useMemo(() => getCurrentOverBalls(commentary), [commentary])

  if (!innings || balls.length === 0) return null

  // Total runs in this over so far
  const runsInOver = balls.reduce((sum, b) => sum + runsFromBall(b), 0)
  const hasWicket = balls.some((b) => b.kind === "wicket")
  const overNum = overNumberOf(balls[0])
  const ballsBowled = balls.length
  const emptySlots = Math.max(0, 6 - ballsBowled)

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-amber-500" />
          <span className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            This Over
          </span>
          <span className="font-display text-sm font-bold tabular-nums text-foreground">
            {overNum}
          </span>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {runsInOver} run{runsInOver !== 1 ? "s" : ""}
          {hasWicket && <span className="ml-1 font-bold text-red-600">· W</span>}
          <span className="ml-1 text-muted-foreground/60">({ballsBowled}/6)</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {balls.map((b) => (
          <ThisOverBall key={b.id} entry={b} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <ThisOverBall key={`empty-${i}`} empty />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Live Score Banner — prominent navy hero with both teams' scores           */
/* -------------------------------------------------------------------------- */

export function LiveScoreBanner({
  match,
  liveState,
}: {
  match: Match
  liveState: LiveMatchState
}) {
  const innings = liveState.innings
  const currentIdx = liveState.currentInnings
  const current = innings[currentIdx]
  const t1 = match.team1
  const t2 = match.team2

  if (!current) return null

  // Group innings by team
  const t1Innings = innings.filter((i) => i.battingTeamId === match.team1Id)
  const t2Innings = innings.filter((i) => i.battingTeamId === match.team2Id)

  const battingTeam =
    current.battingTeamId === match.team1Id ? match.team1 : match.team2
  const bowlingTeam =
    current.battingTeamId === match.team1Id ? match.team2 : match.team1

  // Run rates
  const crr =
    current.balls > 0
      ? ((current.runs / current.balls) * 6).toFixed(2)
      : "0.00"

  // DLS-aware chase numbers — when the scorer has applied a DLS revision, the
  // target + overs on offer change mid-chase, so the runs needed / balls left
  // shown here must use the revised values, not the original innings target.
  const chaseTarget =
    liveState.dlsTarget && liveState.dlsTarget > 0
      ? liveState.dlsTarget
      : current.target
  const isChasing = chaseTarget !== null && chaseTarget > 0
  const runsNeeded = isChasing ? Math.max(0, (chaseTarget ?? 0) - current.runs) : 0
  const chaseOvers =
    liveState.dlsRevisedOvers && liveState.dlsRevisedOvers > 0
      ? liveState.dlsRevisedOvers
      : liveState.maxOvers
  const ballsRemaining =
    chaseOvers > 0 ? Math.max(0, chaseOvers * 6 - current.balls) : 0
  const rrr =
    isChasing && ballsRemaining > 0
      ? ((runsNeeded / ballsRemaining) * 6).toFixed(2)
      : null

  // DLS par-score — only meaningful during the chasing innings when the
  // scorer has applied a DLS revised target after a rain interruption.
  // Recomputed from the current live state (runs, wickets, overs faced) so
  // it updates ball-by-ball. Green when the chasing side is ahead of par,
  // red when behind. (Plain derivation — no useMemo — so this stays after
  // the `if (!current) return null` guard without violating the Rules of
  // Hooks. The DLS table lookup is a handful of arithmetic ops.)
  const dlsParScore = (() => {
    const dlsTarget = liveState.dlsTarget ?? null
    const dlsRevisedOvers = liveState.dlsRevisedOvers ?? null
    if (
      !dlsTarget ||
      !dlsRevisedOvers ||
      innings.length < 2 ||
      currentIdx < 1 ||
      liveState.maxOvers <= 0
    ) {
      return null
    }
    const firstInn = innings[0]
    if (!firstInn) return null
    try {
      const result = calculateDLS(
        firstInn.runs,
        Math.floor(firstInn.balls / 6),
        firstInn.wickets,
        current.runs,
        Math.floor(current.balls / 6),
        current.wickets,
        liveState.maxOvers,
        dlsRevisedOvers,
      )
      return result.parScore
    } catch {
      return null
    }
  })()
  const aheadOfPar =
    dlsParScore !== null ? current.runs >= dlsParScore : false

  // Match status text
  const statusText = (() => {
    if (liveState.result) return liveState.result
    if (liveState.status === "completed") return "Match complete"
    // Innings break: current innings has ended (declared or all out) but no
    // next innings has started — detected when the current innings has 0 balls
    // but the previous innings is complete.
    if (currentIdx > 0 && current.balls === 0 && current.wickets === 0) {
      return "Innings break"
    }
    return `${ordinal(currentIdx + 1)} innings`
  })()

  const inningsLabel = (idx: number): string => {
    const all = innings.filter(
      (i) =>
        i.battingTeamId === (idx === 0 ? match.team1Id : match.team2Id),
    )
    const which = all.length
    return which > 1 ? ` (${ordinal(which)})` : ""
  }

  return (
    <div
      className="overflow-hidden rounded-xl ring-2 ring-red-500/50"
      aria-label="Live match score"
    >
      {/* Top status bar — LIVE badge + status */}
      <div className="flex items-center justify-between gap-2 bg-[#0f1729] px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Live
          </span>
          <span className="font-display text-xs font-semibold uppercase tracking-wide text-white/70 sm:text-sm">
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/50">
          <Radio className="h-3 w-3 animate-pulse text-red-400" />
          <span className="hidden sm:inline">Real-time scoring</span>
        </div>
      </div>

      {/* Main hero — navy gradient with two teams */}
      <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] px-4 py-5 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6">
          {/* Team 1 */}
          <TeamScoreColumn
            team={t1}
            innings={t1Innings}
            labelSuffix={inningsLabel(0)}
            highlight={current.battingTeamId === match.team1Id}
            align="left"
          />

          {/* VS / status divider */}
          <div className="flex flex-col items-center gap-1 py-1">
            <span className="font-display text-xs font-bold uppercase tracking-widest text-white/30">
              vs
            </span>
          </div>

          {/* Team 2 */}
          <TeamScoreColumn
            team={t2}
            innings={t2Innings}
            labelSuffix={inningsLabel(1)}
            highlight={current.battingTeamId === match.team2Id}
            align="right"
          />
        </div>

        {/* Run-rate strip */}
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:grid-cols-4 sm:gap-4">
          <RateStat
            icon={TrendingUp}
            label="CRR"
            value={crr}
            sub={`${current.battingTeamShortName}`}
          />
          {rrr !== null ? (
            <RateStat
              icon={Target}
              label="RRR"
              value={rrr}
              sub={`${runsNeeded} needed`}
              accent
            />
          ) : (
            <RateStat
              icon={Zap}
              label="Balls Left"
              value={liveState.maxOvers > 0 ? String(ballsRemaining) : "—"}
              sub={liveState.maxOvers > 0 ? `${oversString(current.balls)} bowled` : "unlimited"}
            />
          )}
          <RateStat
            icon={Users}
            label="Wickets"
            value={`${current.wickets}/10`}
            sub={`${10 - current.wickets} in hand`}
          />
          <RateStat
            icon={Activity}
            label="Overs"
            value={oversString(current.balls)}
            sub={liveState.maxOvers > 0 ? `${chaseOvers} max` : "Test"}
          />
        </div>
      </div>

      {/* Bottom chase banner — if a target is being chased */}
      {isChasing && (
        <div className="bg-amber-500 px-4 py-2 text-center sm:px-6">
          <p className="font-display text-sm font-bold text-amber-950">
            {battingTeam?.shortName ?? current.battingTeamShortName} need{" "}
            <span className="tabular-nums">{runsNeeded}</span> run
            {runsNeeded !== 1 ? "s" : ""} from{" "}
            <span className="tabular-nums">{ballsRemaining}</span> ball
            {ballsRemaining !== 1 ? "s" : ""}
            {rrr !== null && ` · RRR ${rrr}`}
            {dlsParScore !== null && (
              <span
                className={cn(
                  "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                  aheadOfPar
                    ? "bg-emerald-700 text-emerald-50"
                    : "bg-red-700 text-red-50",
                )}
                title="Duckworth-Lewis-Stern par score at this position"
              >
                Par: {dlsParScore}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Innings break / DLS note */}
      {liveState.note && (
        <div className="bg-[#162244] px-4 py-2 text-center text-xs font-medium text-white/70 sm:px-6">
          {liveState.note}
        </div>
      )}
      {liveState.dlsTarget ? (
        <div className="flex flex-col items-center justify-center gap-0.5 bg-sky-600 px-4 py-1.5 text-center sm:px-6">
          <span className="font-display text-xs font-bold text-white">
            DLS Revised Target: {liveState.dlsTarget}
            {liveState.dlsRevisedOvers
              ? ` from ${liveState.dlsRevisedOvers} overs`
              : ""}
          </span>
          {isChasing && (
            <span className="font-display text-[11px] font-semibold text-white/85">
              {battingTeam?.shortName ?? current.battingTeamShortName} need{" "}
              <span className="tabular-nums">{runsNeeded}</span> off{" "}
              <span className="tabular-nums">{ballsRemaining}</span> — par{" "}
              <span className="tabular-nums">{dlsParScore ?? "—"}</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** One team's score column in the live banner. */
function TeamScoreColumn({
  team,
  innings,
  labelSuffix,
  highlight,
  align,
}: {
  team?: Match["team1"]
  innings: ScorerInnings[]
  labelSuffix: string
  highlight: boolean
  align: "left" | "right"
}) {
  const hasScored = innings.length > 0 && innings.some((i) => i.balls > 0 || i.runs > 0)
  const lastInn = innings[innings.length - 1]
  const alignClass = align === "left" ? "items-start text-left" : "items-end text-right"

  return (
    <div className={`flex flex-col gap-2 ${alignClass}`}>
      <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <div
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full bg-white/10 ring-2 sm:h-12 sm:w-12",
            highlight ? "ring-amber-400" : "ring-white/20",
          )}
        >
          {team && <TeamBadge team={team} size="md" />}
        </div>
        <div className={align === "right" ? "text-right" : "text-left"}>
          <div className="font-display text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm">
            {team?.shortName ?? "—"}
            <span className="text-white/40">{labelSuffix}</span>
          </div>
          {highlight && (
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-400">
              Batting
            </div>
          )}
        </div>
      </div>
      {hasScored && lastInn ? (
        <div className="text-white">
          <div className="font-display text-2xl font-extrabold tabular-nums leading-none sm:text-3xl">
            {lastInn.runs}
            <span className="text-white/60">/{lastInn.wickets}</span>
          </div>
          <div className="mt-0.5 font-display text-xs font-normal tabular-nums text-white/50">
            ({oversString(lastInn.balls)} ov)
          </div>
        </div>
      ) : (
        <div className="font-display text-sm text-white/40">Yet to bat</div>
      )}
    </div>
  )
}

/** A single rate stat cell in the run-rate strip. */
function RateStat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1.5",
        accent && "bg-amber-500/15 ring-1 ring-amber-400/30",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          accent ? "text-amber-400" : "text-white/40",
        )}
      />
      <div className="min-w-0">
        <div
          className={cn(
            "font-display text-[9px] font-bold uppercase tracking-widest",
            accent ? "text-amber-300" : "text-white/40",
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "font-display text-sm font-bold tabular-nums leading-none",
            accent ? "text-amber-200" : "text-white",
          )}
        >
          {value}
        </div>
        {sub && (
          <div className="truncate font-display text-[10px] text-white/40">
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Recent Overs Strip — horizontal strip of the last 5 completed overs        */
/* -------------------------------------------------------------------------- */

interface OverSummary {
  summary: CommentaryEntry
  balls: CommentaryEntry[]
  runs: number
  hasWicket: boolean
  overNum: number
}

/** Collect the last N completed overs from the commentary. Each completed over
 *  has a "kind: over" summary entry followed (in array order, which is newest
 *  first) by that over's balls. We return oldest-first for left-to-right strip. */
function getRecentOvers(commentary: CommentaryEntry[], count: number): OverSummary[] {
  const summaries: OverSummary[] = []
  for (let i = 0; i < commentary.length; i++) {
    const entry = commentary[i]
    if (entry.kind !== "over") continue
    // Collect this over's balls: from i+1 until the next "over" summary or end
    const balls: CommentaryEntry[] = []
    for (let j = i + 1; j < commentary.length; j++) {
      if (commentary[j].kind === "over") break
      if (BALL_KINDS.has(commentary[j].kind)) balls.push(commentary[j])
    }
    // balls are newest first (14.6, 14.5, ...); reverse for chron display
    balls.reverse()
    const runs = balls.reduce((s, b) => s + runsFromBall(b), 0)
    const hasWicket = balls.some((b) => b.kind === "wicket")
    const overNum = parseInt(entry.text.match(/over (\d+)/)?.[1] || "0", 10)
    summaries.push({ summary: entry, balls, runs, hasWicket, overNum })
    if (summaries.length >= count) break
  }
  // Display oldest -> newest (left to right)
  return summaries.reverse()
}

export function RecentOversStrip({ liveState }: { liveState: LiveMatchState }) {
  const commentary = liveState.commentary ?? []
  const overs = useMemo(() => getRecentOvers(commentary, 5), [commentary])

  if (overs.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-amber-500" />
        <span className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Recent Overs
        </span>
      </div>
      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible">
        {overs.map((o) => (
          <OverSummaryCard
            key={o.summary.id}
            data={o}
          />
        ))}
      </div>
    </div>
  )
}

function OverSummaryCard({ data }: { data: OverSummary }) {
  const { overNum, runs, hasWicket, balls } = data
  // Color accent by over outcome
  const accent = hasWicket
    ? "border-l-red-500"
    : runs === 0
      ? "border-l-gray-400"
      : runs >= 10
        ? "border-l-purple-500"
        : runs >= 6
          ? "border-l-sky-500"
          : "border-l-emerald-500"

  return (
    <div
      className={cn(
        "flex min-w-[140px] flex-col gap-1 rounded-md border border-l-4 border-border bg-muted/30 px-2.5 py-2 sm:min-w-0",
        accent,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-display text-xs font-bold tabular-nums text-foreground">
          Over {overNum}
        </span>
        <span
          className={cn(
            "font-display text-xs font-bold tabular-nums",
            hasWicket ? "text-red-600" : runs >= 10 ? "text-purple-600" : "text-emerald-600",
          )}
        >
          {runs} run{runs !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {balls.length > 0 ? (
          balls.map((b) => (
            <ThisOverBall key={b.id} entry={b} size="sm" />
          ))
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Current Partnership — small card showing the live batting pair            */
/* -------------------------------------------------------------------------- */

export function CurrentPartnership({ liveState }: { liveState: LiveMatchState }) {
  const innings = liveState.innings[liveState.currentInnings]
  if (!innings) return null

  const striker = innings.batsmen.find((b) => b.id === liveState.strikerId)
  const nonStriker = innings.batsmen.find((b) => b.id === liveState.nonStrikerId)

  if (!striker && !nonStriker) return null

  // Current partnership runs + balls from the partnership start markers
  const partRuns = Math.max(0, innings.runs - innings.partnershipStartRuns)
  const partBalls = Math.max(0, innings.balls - innings.partnershipStartBalls)
  const wicketNo = innings.partnerships.length + 1

  // Partnership run rate
  const partRR =
    partBalls > 0 ? ((partRuns / partBalls) * 6).toFixed(2) : "0.00"

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-amber-500" />
          <span className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Partnership
          </span>
          <span className="font-display text-xs font-bold tabular-nums text-foreground">
            #{wicketNo}
          </span>
        </div>
        <span className="font-display text-sm font-bold tabular-nums text-emerald-600">
          {partRuns}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({partBalls} · RR {partRR})
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BatsmanCell
          name={striker?.name ?? "—"}
          runs={striker?.runs ?? 0}
          balls={striker?.balls ?? 0}
          isStriker={Boolean(striker)}
        />
        <BatsmanCell
          name={nonStriker?.name ?? "—"}
          runs={nonStriker?.runs ?? 0}
          balls={nonStriker?.balls ?? 0}
          isStriker={false}
        />
      </div>
    </div>
  )
}

/** Subtle milestone badge for scorecard batting rows — a soft amber "50"
 *  chip once a batter reaches fifty, solid gold from a century up. Derived
 *  purely from the batter's runs, so it works for live + persisted cards.
 *  Exported for reuse by the scorecard components. */
export function MilestoneBadge({ runs }: { runs: number }) {
  if (!Number.isFinite(runs) || runs < 50) return null
  const century = runs >= 100
  return (
    <Badge
      variant="outline"
      aria-label={century ? "Century" : "Half-century"}
      className={cn(
        "shrink-0 rounded-full border-transparent px-1.5 py-0 font-display text-[10px] font-bold leading-4 tabular-nums",
        century
          ? "bg-amber-400 text-amber-950 shadow-sm"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      )}
    >
      {century ? "100" : "50"}
    </Badge>
  )
}

function BatsmanCell({
  name,
  runs,
  balls,
  isStriker,
}: {
  name: string
  runs: number
  balls: number
  isStriker: boolean
}) {
  // Strike-rate milestone pill — shown when the batter has reached 50,
  // 100, or 150. Gold-colored, matching the trophy treatment in the feed.
  const milestone =
    runs >= 150 ? "150" : runs >= 100 ? "100" : runs >= 50 ? "50" : null
  return (
    <div
      className={cn(
        "rounded-md px-2.5 py-1.5",
        isStriker ? "bg-amber-500/10 ring-1 ring-amber-400/30" : "bg-muted/40",
      )}
    >
      <div className="flex items-center gap-1">
        {isStriker && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
        )}
        <span className="truncate font-display text-xs font-bold text-foreground">
          {name}
        </span>
        {milestone && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            <Trophy className="h-2.5 w-2.5" />
            {milestone}
          </span>
        )}
      </div>
      <div className="font-display text-sm font-bold tabular-nums text-foreground">
        {runs}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          ({balls})
        </span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Enhanced Commentary Feed — over markers, ball numbers, color-coded borders */
/* -------------------------------------------------------------------------- */

/** Kind → left border color (ESPNcricinfo-style semantic coding). */
const BORDER_BY_KIND: Record<string, string> = {
  wicket: "border-l-red-500",
  six: "border-l-purple-500",
  boundary: "border-l-sky-500",
  extra: "border-l-amber-500",
  manual: "border-l-emerald-500",
  info: "border-l-amber-400",
  over: "border-l-slate-400",
  run: "border-l-emerald-400",
  dot: "border-l-slate-300",
  milestone: "border-l-amber-500",
}

const LABEL_BY_KIND: Record<string, { text: string; cls: string }> = {
  wicket: { text: "WICKET", cls: "text-red-600 dark:text-red-400" },
  six: { text: "SIX", cls: "text-purple-600 dark:text-purple-400" },
  boundary: { text: "FOUR", cls: "text-sky-600 dark:text-sky-400" },
  extra: { text: "EXTRA", cls: "text-amber-600 dark:text-amber-400" },
  manual: { text: "NOTE", cls: "text-emerald-600 dark:text-emerald-400" },
  info: { text: "INFO", cls: "text-amber-600 dark:text-amber-400" },
  milestone: { text: "MILESTONE", cls: "text-amber-600 dark:text-amber-400" },
}

/** Enhanced commentary row with ball number, color-coded left border, and
 *  over-boundary separators. */
function EnhancedCommentaryRow({ entry }: { entry: CommentaryEntry }) {
  // Over boundary → bold separator
  if (entry.kind === "over") {
    const overMatch = entry.text.match(/over (\d+)/)
    const overNo = overMatch ? overMatch[1] : ""
    const scorePart = entry.text.split("—")[1]?.trim() ?? entry.text
    return (
      <div className="flex items-center gap-2 bg-[#1e2a5e]/5 border-l-4 border-l-[#1e2a5e] px-3 py-2 dark:bg-[#1e2a5e]/10">
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[#1e2a5e] dark:text-[#5b6bb0] shrink-0">
          End of Over {overNo}
        </span>
        <span className="font-display text-xs font-bold tabular-nums text-foreground truncate">
          {scorePart}
        </span>
      </div>
    )
  }

  const borderCls = BORDER_BY_KIND[entry.kind] ?? "border-l-slate-300"
  const label = LABEL_BY_KIND[entry.kind]
  const isAudio = entry.text.startsWith("[audio:")
  const audioUrl = isAudio ? entry.text.slice(7, -1) : null
  const isMilestone = entry.kind === "milestone"

  return (
    <div
      className={cn(
        "flex gap-2.5 border-b border-border/40 border-l-4 px-3 py-2 last:border-b-0",
        borderCls,
        entry.kind === "wicket" && "bg-red-50/50 dark:bg-red-950/20",
        entry.kind === "six" && "bg-purple-50/30 dark:bg-purple-950/10",
        entry.kind === "boundary" && "bg-sky-50/30 dark:bg-sky-950/10",
        isMilestone && "bg-amber-50/60 dark:bg-amber-950/20",
      )}
    >
      {/* Ball number annotation — over.ball notation */}
      <div className="w-10 shrink-0 pt-0.5 text-right">
        <span className="font-display text-[11px] font-bold tabular-nums text-muted-foreground">
          {entry.over}
        </span>
      </div>
      {/* Ball chip / mini circle */}
      <div className="shrink-0 pt-0.5">
        <ThisOverBall entry={entry} size="sm" />
      </div>
      {/* Text */}
      <div className="min-w-0 flex-1 pt-0.5">
        {label && (
          <span className={cn("mr-1.5 text-[10px] font-bold uppercase tracking-wide", label.cls)}>
            {label.text}
          </span>
        )}
        {isAudio && audioUrl ? (
          <audio controls src={audioUrl} className="h-8 w-full max-w-xs" preload="none" />
        ) : (
          <>
            {entry.kind === "ai" && (
              <span className="mr-1.5 inline-block rounded bg-slate-700 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white align-middle">
                AI
              </span>
            )}
            <span
              className={cn(
                "text-[13px] leading-relaxed text-foreground",
                entry.kind === "ai" && "italic text-foreground/80",
                isMilestone && "font-bold text-amber-700 dark:text-amber-300",
              )}
            >
              {entry.text}
            </span>
            {entry.kind === "ai" && entry.audioUrl && (
              <audio controls src={entry.audioUrl} className="mt-1 h-7 w-full max-w-[240px]" preload="none" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function EnhancedCommentaryFeed({
  liveState,
  maxEntries = 80,
}: {
  liveState: LiveMatchState
  maxEntries?: number
}) {
  const commentary = liveState.commentary ?? []
  const entries = useMemo(() => commentary.slice(0, maxEntries), [commentary, maxEntries])

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No commentary yet. The ball-by-ball feed appears here as balls are scored.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Radio className="h-4 w-4 text-red-500" />
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
            Live Commentary
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </span>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {entries.map((entry) => (
          <EnhancedCommentaryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
