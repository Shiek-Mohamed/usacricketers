"use client"

import { useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { useMatch } from "@/lib/use-data"
import { useLiveScore } from "@/lib/use-live-score"
import { oversString, type LiveMatchState, type ScorerInnings } from "@/lib/scoring"
import { TeamBadge, FormatPill, formatDate } from "@/components/cricket/ui"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ShareButtons } from "@/components/site/share-buttons"
import { CommentaryFeedRow } from "@/components/cricket/ball-chip"
import {
  Activity,
  Radio,
  CloudRain,
  ChevronLeft,
  Trophy,
  MapPin,
  Clock,
  WifiOff,
  Wifi,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Commentary kind → color + label mapping                                   */
/* -------------------------------------------------------------------------- */

const KIND_STYLES: Record<string, { dot: string; text: string; label: string; bg: string }> = {
  wicket: { dot: "bg-red-500", text: "text-red-700 dark:text-red-400", label: "WICKET", bg: "bg-red-500/5" },
  six: { dot: "bg-purple-500", text: "text-purple-700 dark:text-purple-400", label: "SIX", bg: "bg-purple-500/5" },
  boundary: { dot: "bg-sky-500", text: "text-sky-700 dark:text-sky-400", label: "FOUR", bg: "bg-sky-500/5" },
  manual: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", label: "COMMENTARY", bg: "bg-emerald-500/5" },
  info: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", label: "INFO", bg: "bg-amber-500/5" },
  over: { dot: "bg-slate-400", text: "text-slate-600 dark:text-slate-400", label: "OVER", bg: "bg-slate-500/5" },
  run: { dot: "bg-slate-300", text: "text-slate-600 dark:text-slate-400", label: "", bg: "" },
  extra: { dot: "bg-orange-400", text: "text-orange-700 dark:text-orange-400", label: "EXTRA", bg: "bg-orange-500/5" },
  dot: { dot: "bg-slate-200", text: "text-slate-500", label: "", bg: "" },
}

/** Kinds that qualify as "key moments" — shown in the sidebar. */
const KEY_MOMENT_KINDS = new Set(["wicket", "six", "boundary", "manual", "info"])

/* -------------------------------------------------------------------------- */
/*  Main view                                                                  */
/* -------------------------------------------------------------------------- */

export function LiveBlogView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data: match, loading: matchLoading } = useMatch(id)
  const { liveState, connected } = useLiveScore(id, null)

  const innings = liveState?.innings ?? []
  const currentInnings = innings[liveState?.currentInnings ?? 0] ?? null
  const commentary = liveState?.commentary ?? []
  const keyMoments = useMemo(
    () => commentary.filter((c) => KEY_MOMENT_KINDS.has(c.kind)),
    [commentary],
  )

  // The current striker, non-striker, and bowler are identified by ID in the
  // live state (not by an isBatting/isBowling flag on the player objects).
  const striker = currentInnings?.batsmen.find((b) => b.id === liveState?.strikerId)
  const nonStriker = currentInnings?.batsmen.find((b) => b.id === liveState?.nonStrikerId)
  const bowler = currentInnings?.bowlers.find((b) => b.id === liveState?.bowlerId)

  // No match selected
  if (!id) {
    return (
      <EmptyState
        icon={Activity}
        title="No match selected"
        message="Pick a live match to follow the ball-by-ball blog."
        action={{ label: "View live matches", view: "matches" }}
      />
    )
  }

  // Match loading
  if (matchLoading && !match) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    )
  }

  // Match not found
  if (!match) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Match not found"
        message="This match doesn't exist or has been removed."
        action={{ label: "View all matches", view: "matches" }}
      />
    )
  }

  const team1 = match.team1
  const team2 = match.team2
  const isLive = match.status === "live"

  return (
    <div className="space-y-4">
      {/* Back link */}
      <button
        onClick={() => navigate("match-detail", match.id)}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Match details
      </button>

      {/* ─── Match header + live score ticker ─── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Navy header bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1e2a5e] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-red-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Live
              </span>
            ) : (
              <FormatPill format={match.format} />
            )}
            <span className="font-display text-sm font-semibold uppercase tracking-wide sm:text-base">
              {match.matchNo} · {match.series?.name ?? "Series"}
            </span>
          </div>
          {/* Connection status + share buttons */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              {connected ? (
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <Wifi className="h-3 w-3" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-white/50">
                  <WifiOff className="h-3 w-3" /> Reconnecting…
                </span>
              )}
            </span>
            {/* Share buttons — styled for the dark navy header.
                Uses window.location.href (the live blog URL) by default. */}
            <ShareButtons
              title={`${team1?.shortName ?? "?"} vs ${team2?.shortName ?? "?"} — Live Blog | USACricketers`}
              className="[&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-white [&_button:hover]:bg-white/20 [&_span]:text-white/60"
            />
          </div>
        </div>

        {/* DLS revised target banner */}
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

        {/* Score ticker — the auto-updating live score */}
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          {currentInnings ? (
            <ScoreTicker
              innings={currentInnings}
              team1={team1}
              team2={team2}
              striker={striker}
              nonStriker={nonStriker}
              bowler={bowler}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              {team1 && team2 && (
                <div className="flex items-center justify-center gap-4 sm:gap-8">
                  <TeamColumn team={team1} />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    vs
                  </span>
                  <TeamColumn team={team2} />
                </div>
              )}
              <p className="max-w-sm text-sm text-muted-foreground">
                {isLive
                  ? "Waiting for the scorer to start the first ball…"
                  : "This match hasn't started yet. Check back when it's live."}
              </p>
            </div>
          )}

          {/* Venue + date */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-[12px] text-muted-foreground">
            {match.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {match.venue}
                {match.city ? `, ${match.city}` : ""}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDate(match.startDate)}
            </span>
            {match.result && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Trophy className="h-3 w-3" /> {match.result}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── No live state yet — show prompt + key moments empty ─── */}
      {!currentInnings ? (
        <EmptyState
          icon={Radio}
          title={isLive ? "Waiting for live scoring" : "Match not live"}
          message={
            isLive
              ? "The scorer hasn't started entering balls yet. This page will auto-update the moment scoring begins."
              : "Live commentary appears here when the match goes live."
          }
          action={{ label: "View match details", view: "match-detail" }}
        />
      ) : (
        /* ─── Two-column: commentary feed + key moments sidebar ─── */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Commentary feed — main column */}
          <div className="lg:col-span-8">
            <CommentaryFeed commentary={commentary} />
          </div>

          {/* Key moments — sidebar */}
          <aside className="lg:col-span-4">
            <KeyMomentsSidebar moments={keyMoments} />
          </aside>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Score ticker — the auto-updating live score                               */
/* -------------------------------------------------------------------------- */

function ScoreTicker({
  innings,
  team1,
  team2,
  striker,
  nonStriker,
  bowler,
}: {
  innings: ScorerInnings
  team1?: { shortName: string; primaryColor: string; accentColor: string; logoUrl?: string | null }
  team2?: { shortName: string; primaryColor: string; accentColor: string; logoUrl?: string | null }
  striker?: { id: string; name: string; runs: number; balls: number }
  nonStriker?: { id: string; name: string; runs: number; balls: number }
  bowler?: { id: string; name: string; balls: number; runsConceded: number; wickets: number }
}) {
  // Find the batting team object — match by shortName (the innings carries
  // the batting team's short name, not the full Team object).
  const battingTeam =
    innings.battingTeamShortName === team1?.shortName ? team1 : team2
  const overs = oversString(innings.balls)
  const crr = innings.balls > 0 ? ((innings.runs / innings.balls) * 6).toFixed(2) : "0.00"
  const bowlerOvers = bowler ? oversString(bowler.balls) : "0.0"

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Team + score */}
      <div className="flex items-center gap-3">
        {battingTeam && <TeamBadge team={battingTeam} size="lg" />}
        <div>
          <div className="font-display text-2xl font-black leading-none tracking-tight text-foreground sm:text-4xl">
            {innings.battingTeamShortName}{" "}
            <span className="text-red-600">
              {innings.runs}/{innings.wickets}
            </span>
          </div>
          <div className="mt-1 font-display text-[12px] font-medium tracking-wide text-muted-foreground">
            ({overs} ov · CRR {crr})
          </div>
        </div>
      </div>

      {/* Batsmen + bowler (compact) */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:flex sm:flex-col sm:items-end sm:gap-0.5">
        {striker && (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-primary">{striker.name}</span>
            <span className="text-muted-foreground">
              {striker.runs} ({striker.balls})
            </span>
          </div>
        )}
        {nonStriker && (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">{nonStriker.name}</span>
            <span className="text-muted-foreground">
              {nonStriker.runs} ({nonStriker.balls})
            </span>
          </div>
        )}
        {bowler && (
          <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
            <span className="text-[10px] uppercase tracking-wide">Bowl:</span>
            <span className="font-medium text-foreground">{bowler.name}</span>
            <span>
              {bowler.wickets}-{bowler.runsConceded} ({bowlerOvers})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Commentary feed — scrolling timeline (newest first)                       */
/* -------------------------------------------------------------------------- */

function CommentaryFeed({
  commentary,
}: {
  commentary: LiveMatchState["commentary"]
}) {
  if (commentary.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No commentary yet. The feed will appear here as balls are scored.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
          Live Commentary
        </h2>
        <span className="text-xs text-muted-foreground">
          {commentary.length} entries
        </span>
      </div>

      {/* Scrollable feed — max height with custom scrollbar */}
      <div className="max-h-[70vh] overflow-y-auto">
        {commentary.map((entry) => (
          <CommentaryFeedRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}

function CommentaryRow({
  entry,
}: {
  entry: LiveMatchState["commentary"][number]
}) {
  const style = KIND_STYLES[entry.kind] ?? KIND_STYLES.dot

  // Voice clips are stored as `[audio:/api/uploads/voice-xxx.webm]`
  const isAudio = entry.text.startsWith("[audio:")
  const audioUrl = isAudio ? entry.text.slice(7, -1) : null

  return (
    <div
      className={cn(
        "flex gap-3 border-b border-border/50 px-4 py-2.5 transition-colors last:border-0 hover:bg-muted/30",
        style.bg,
      )}
    >
      {/* Over label */}
      <div className="w-12 shrink-0 pt-0.5 text-right">
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {entry.over}
        </span>
      </div>

      {/* Kind dot */}
      <div className="flex flex-col items-center pt-1.5">
        <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        {style.label && (
          <span className={cn("mr-1.5 text-[10px] font-bold uppercase tracking-wide", style.text)}>
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
}

/* -------------------------------------------------------------------------- */
/*  Key moments sidebar                                                        */
/* -------------------------------------------------------------------------- */

function KeyMomentsSidebar({
  moments,
}: {
  moments: LiveMatchState["commentary"]
}) {
  return (
    <div className="sticky top-16 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
          Key Moments
        </h2>
      </div>

      {moments.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">
            Wickets, sixes and milestones will appear here.
          </p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          {moments.map((entry) => {
            const style = KIND_STYLES[entry.kind] ?? KIND_STYLES.dot
            return (
              <div
                key={entry.id}
                className="flex gap-2.5 border-b border-border/50 px-4 py-2.5 last:border-0"
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", style.dot)} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {style.label && (
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide", style.text)}>
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
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function TeamColumn({
  team,
}: {
  team: { shortName: string; primaryColor: string; accentColor: string; logoUrl?: string | null }
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <TeamBadge team={team} size="xl" />
      <span className="text-sm font-bold text-foreground">{team.shortName}</span>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: React.ElementType
  title: string
  message: string
  action?: { label: string; view: Parameters<ReturnType<typeof useAppStore.getState>["navigate"]>[0] }
}) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
      {action && (
        <Button
          onClick={() => navigate(action.view)}
          className="mt-6 bg-[#1e2a5e] text-white hover:bg-[#283672]"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
