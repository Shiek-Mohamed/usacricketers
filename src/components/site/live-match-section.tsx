"use client"

import { useMemo } from "react"
import { useLiveScore } from "@/lib/use-live-score"
import { oversString, type LiveMatchState } from "@/lib/scoring"
import { Radio, Wifi, WifiOff, ChevronRight, Trophy } from "lucide-react"

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
}

/** Kinds that qualify as "key moments" — shown in the right column. */
const KEY_MOMENT_KINDS = new Set(["wicket", "six", "boundary", "manual", "info"])

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

  const innings = liveState?.innings ?? []
  const currentInnings = innings[liveState?.currentInnings ?? 0] ?? null
  const commentary = liveState?.commentary ?? []

  const striker = currentInnings?.batsmen.find((b) => b.id === liveState?.strikerId)
  const bowler = currentInnings?.bowlers.find((b) => b.id === liveState?.bowlerId)

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
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-display text-[12px] font-medium">
            {striker && (
              <span className="font-bold text-red-600">
                {striker.name}{" "}
                <span className="font-normal text-muted-foreground">
                  {striker.runs} ({striker.balls})
                </span>
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
              {recentCommentary.map((entry) => {
                const style = KIND_STYLES[entry.kind] ?? KIND_STYLES.dot
                const isAudio = entry.text.startsWith("[audio:")
                const audioUrl = isAudio ? entry.text.slice(7, -1) : null
                return (
                  <div
                    key={entry.id}
                    className={`flex gap-2.5 border-b border-border/40 px-3 py-2 last:border-0 ${style.bg}`}
                  >
                    <span className="w-10 shrink-0 pt-0.5 text-right text-[11px] font-bold tabular-nums text-muted-foreground">
                      {entry.over}
                    </span>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      {style.label && (
                        <span className={`mr-1.5 text-[10px] font-bold uppercase tracking-wide ${style.text}`}>
                          {style.label}
                        </span>
                      )}
                      {isAudio && audioUrl ? (
                        <audio controls src={audioUrl} className="h-8 w-full max-w-xs" preload="none" />
                      ) : (
                        <span className="text-[13px] leading-relaxed text-foreground">
                          {entry.text}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
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
