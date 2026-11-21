"use client"

import { useMemo } from "react"
import { useLiveScore } from "@/lib/use-live-score"
import { useMatch } from "@/lib/use-data"
import { oversString, type LiveMatchState } from "@/lib/scoring"
import { calculateDLS } from "@/lib/dls"
import { Radio, Wifi, WifiOff, ChevronRight, Trophy, CloudRain, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CommentaryFeedRow } from "@/components/cricket/ball-chip"

/* Commentary kind → color mapping (matches the live blog view) */
const KIND_STYLES: Record<string, { dot: string; label: string; text: string; bg: string }> = {
  wicket: { dot: "bg-red-500", label: "WICKET", text: "text-red-700 dark:text-red-400", bg: "bg-red-500/5" },
  six: { dot: "bg-purple-500", label: "SIX", text: "text-purple-700 dark:text-purple-400", bg: "bg-purple-500/5" },
  boundary: { dot: "bg-sky-500", label: "FOUR", text: "text-sky-700 dark:text-sky-400", bg: "bg-sky-500/5" },
  manual: { dot: "bg-emerald-500", label: "COMMENTARY", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/5" },
  info: { dot: "bg-amber-500", label: "INFO", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/5" },
  over: { dot: "bg-slate-400", label: "OVER", text: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/5" },
  run: { dot: "bg-slate-300", label: "", text: "text-slate-600 dark:text-slate-400", bg: "" },
  extra: { dot: "bg-orange-400", label: "EXTRA", text: "text-orange-700 dark:text-orange-400", bg: "bg-orange-500/5" },
  dot: { dot: "bg-slate-200", label: "", text: "text-slate-500", bg: "" },
  milestone: { dot: "bg-amber-500", label: "MILESTONE", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/5" },
}

/** Kinds that qualify as "key moments" — shown in the right column. */
const KEY_MOMENT_KINDS = new Set(["wicket", "six", "boundary", "manual", "info", "milestone"])

/** Strike-rate milestone pill label for a batter's current runs. */
function milestoneLabel(runs: number): string | null {
  if (runs >= 150) return "150"
  if (runs >= 100) return "100"
  if (runs >= 50) return "50"
  return null
}

/**
 * LiveMatchSection — embeds the live commentary feed directly on the SSR
 * match page so viewers see real-time updates without clicking through to
 * the separate live blog view.
 *
 * - Connects to the score-service WebSocket via useLiveScore(matchId, null)
 *   (read-only — no scorer token needed).
 * - Shows the current batting score + striker/bowler from the live state.
 * - Shows the commentary feed (newest first, color-coded by event kind).
 * - Shows a "View full live blog" link to the immersive view.
 * - Shows a "Waiting for scorer" state when the match is live but no scorer
 *   is broadcasting yet.
 *
 * Only renders when match.status === "live".
 */
export function LiveMatchSection({ matchId }: { matchId: string }) {
  const { liveState, connected } = useLiveScore(matchId, null)
  // Fetch the match so we can read its series' power-play config for the
  // "Power Play" badge. Minimal plumbing (one hook) — the current over comes
  // from the live state; the power-play over-ranges come from the series.
  const { data: match } = useMatch(matchId)

  const innings = liveState?.innings ?? []
  const currentInnings = innings[liveState?.currentInnings ?? 0] ?? null
  const commentary = liveState?.commentary ?? []

  const striker = currentInnings?.batsmen.find((b) => b.id === liveState?.strikerId)
  const bowler = currentInnings?.bowlers.find((b) => b.id === liveState?.bowlerId)

  // Power-play indicator — visual only. Current over is 1-indexed (the over
  // currently being bowled). Shown when the series has power-play enabled and
  // the current over falls within any configured over-range segment.
  const series = match?.series ?? null
  const currentOver = currentInnings ? Math.floor(currentInnings.balls / 6) + 1 : 0
  const inPowerPlay =
    !!(series?.powerPlayEnabled &&
      currentOver > 0 &&
      series.powerPlayOvers.some((seg) => currentOver >= seg.from && currentOver <= seg.to))

  // DLS par-score — recomputed from the live state during the chasing
  // innings (2nd innings onward) when a DLS revised target has been applied.
  // Updates ball-by-ball. Green when the chasing side is ahead of par, red
  // when behind. Null when no DLS target is set or it isn't the chase yet.
  // (Plain derivation — the DLS table lookup is cheap arithmetic.)
  const dlsParScore = (() => {
    if (!liveState || !currentInnings) return null
    const dlsTarget = liveState.dlsTarget ?? null
    const dlsRevisedOvers = liveState.dlsRevisedOvers ?? null
    if (
      !dlsTarget ||
      !dlsRevisedOvers ||
      liveState.innings.length < 2 ||
      (liveState.currentInnings ?? 0) < 1 ||
      liveState.maxOvers <= 0
    ) {
      return null
    }
    const firstInn = liveState.innings[0]
    if (!firstInn) return null
    try {
      const result = calculateDLS(
        firstInn.runs,
        Math.floor(firstInn.balls / 6),
        firstInn.wickets,
        currentInnings.runs,
        Math.floor(currentInnings.balls / 6),
        currentInnings.wickets,
        liveState.maxOvers,
        dlsRevisedOvers,
      )
      return result.parScore
    } catch {
      return null
    }
  })()
  const aheadOfPar =
    dlsParScore !== null && currentInnings
      ? currentInnings.runs >= dlsParScore
      : false

  const recentCommentary = useMemo(
    () => commentary.slice(0, 40), // show the 40 most recent entries
    [commentary],
  )
  // Key moments = wickets, sixes, fours, milestones, manual commentary.
  // Shown in the right column so a viewer who joins late can catch up fast.
  const keyMoments = useMemo(
    () => commentary.filter((c) => KEY_MOMENT_KINDS.has(c.kind)).slice(0, 30),
    [commentary],
  )

  return (
    <section className="overflow-hidden rounded-lg border-2 border-red-500/40 bg-card shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#1e2a5e] to-[#2d3b7a] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <h2 className="font-display text-sm font-bold uppercase tracking-widest text-white">
            Live Commentary
          </h2>
        </div>
        {/* Connection status */}
        <span className="flex items-center gap-1 text-[11px] font-medium">
          {connected ? (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <Wifi className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-white/50">
              <WifiOff className="h-3 w-3" /> Connecting…
            </span>
          )}
        </span>
      </div>

      {/* DLS revised target banner — shown when the scorer has applied a
          DLS target after a rain interruption. */}
      {liveState?.dlsTarget && (
        <div className="flex items-center gap-2 bg-sky-100 px-4 py-2 dark:bg-sky-950/40">
          <CloudRain className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="font-display text-sm font-bold text-sky-800 dark:text-sky-300">
            DLS Revised Target: {liveState.dlsTarget}
          </span>
          <span className="font-display text-xs text-sky-600 dark:text-sky-400">
            from {liveState.dlsRevisedOvers} overs
          </span>
        </div>
      )}

      {/* Current score strip (from live state) */}
      {currentInnings ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <div>
            <span className="font-display text-2xl font-black leading-none tracking-tight text-foreground sm:text-3xl">
              {currentInnings.battingTeamShortName}{" "}
              <span className="text-red-600">
                {currentInnings.runs}/{currentInnings.wickets}
              </span>
            </span>
            <span className="ml-2 font-display text-[12px] font-medium tracking-wide text-muted-foreground">
              ({oversString(currentInnings.balls)} ov · CRR{" "}
              {currentInnings.balls > 0
                ? ((currentInnings.runs / currentInnings.balls) * 6).toFixed(2)
                : "0.00"}
              )
            </span>
            {inPowerPlay && (
              <Badge className="ml-2 border-purple-200 bg-purple-50 font-bold uppercase tracking-wide text-purple-700">
                <Zap className="h-3 w-3" />
                Power Play
              </Badge>
            )}
            {/* DLS par-score — live during a DLS-affected chase. Color-coded
                green (ahead of par) / red (behind par). */}
            {dlsParScore !== null && (
              <span
                className={cn(
                  "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                  aheadOfPar
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
                )}
                title="Duckworth-Lewis-Stern par score at this position"
              >
                Par: {dlsParScore}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-display text-[12px] font-medium">
            {striker && (
              <span className="font-bold text-red-600">
                {striker.name}{" "}
                <span className="font-normal text-muted-foreground">
                  {striker.runs} ({striker.balls})
                </span>
                {milestoneLabel(striker.runs) && (
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    <Trophy className="h-2.5 w-2.5" />
                    {milestoneLabel(striker.runs)}
                  </span>
                )}
              </span>
            )}
            {bowler && (
              <span className="text-muted-foreground">
                <span className="text-[10px] uppercase">Bowl:</span>{" "}
                <span className="font-medium text-foreground">{bowler.name}</span>{" "}
                {bowler.wickets}-{bowler.runsConceded} ({oversString(bowler.balls)})
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Radio className="h-4 w-4 animate-pulse text-red-500" />
          Match is live — waiting for the scorer to start broadcasting balls…
        </div>
      )}

      {/* Two-column split: commentary feed (left) + key moments (right).
          Stacks vertically on mobile (< lg), side-by-side on desktop. */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT: Live commentary feed (ball-by-ball) */}
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-3 py-2">
            <span className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Ball-by-Ball
            </span>
            <span className="text-[10px] text-muted-foreground">
              {recentCommentary.length} entries
            </span>
          </div>
          {recentCommentary.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {recentCommentary.map((entry) => (
                <CommentaryFeedRow key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              No commentary yet — the feed appears here as balls are scored.
            </div>
          )}
        </div>

        {/* RIGHT: Key moments (wickets, sixes, milestones) */}
        <div>
          <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/20 px-3 py-2">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Key Moments
            </span>
          </div>
          {keyMoments.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {keyMoments.map((entry) => {
                const style = KIND_STYLES[entry.kind] ?? KIND_STYLES.dot
                return (
                  <div
                    key={entry.id}
                    className="flex gap-2.5 border-b border-border/40 px-3 py-2 last:border-0"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {style.label && (
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${style.text}`}>
                            {style.label}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{entry.over}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-foreground">
                        {entry.text.startsWith("[audio:")
                          ? "🎙 Voice clip"
                          : entry.text}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Wickets, sixes and milestones appear here.
            </div>
          )}
        </div>
      </div>

      {/* Footer link to the full immersive live blog */}
      <a
        href={`/?view=live-blog&id=${matchId}`}
        className="flex items-center justify-center gap-1.5 border-t border-border bg-muted/20 px-4 py-2.5 text-[13px] font-bold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        <Radio className="h-3.5 w-3.5" />
        Open full live blog
        <ChevronRight className="h-3.5 w-3.5" />
      </a>
    </section>
  )
}
