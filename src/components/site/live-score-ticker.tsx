"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMatches } from "@/lib/use-data"
import type { Match } from "@/lib/types"
import { TeamBadge, formatMatchDate } from "@/components/cricket/ui"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** "12.4" (overs) → 76 (balls). Handles the .0 / no-decimal case too. */
function oversToBalls(oversStr: string | undefined): number {
  if (!oversStr) return 0
  const parts = String(oversStr).split(".")
  const overs = parseInt(parts[0], 10) || 0
  const balls = parts[1] ? parseInt(parts[1], 10) || 0 : 0
  return overs * 6 + balls
}

/** Current run rate from (runs, overs-string). */
function crr(runs: number, oversStr: string | undefined): string {
  const balls = oversToBalls(oversStr)
  if (balls === 0) return "0.00"
  return ((runs * 6) / balls).toFixed(2)
}

/** Latest innings total "rrr/www" for a team in a match (empty if none). */
function lastInnings(match: Match, teamId: string) {
  const sc = match.scorecard
  if (!sc?.innings?.length) return null
  const inn = sc.innings.filter((i) => i.teamId === teamId)
  if (!inn.length) return null
  return inn[inn.length - 1]
}

/* ------------------------------------------------------------------ */
/*  Main ticker                                                        */
/* ------------------------------------------------------------------ */

/**
 * LiveScoreTicker — global horizontal carousel of live + recent + upcoming
 * matches, rendered directly below the site Header on every public page.
 *
 * Design goals (ESPNcricinfo / Cricbuzz style):
 *  - Sticky directly under the header so it stays visible while scrolling.
 *  - Slim (~80px tall) so it never eats too much vertical real estate.
 *  - Auto-scrolls one card every 4s; pauses on hover/focus.
 *  - Manual chevron arrows on lg+ screens.
 *  - Live matches use a red left-accent + pulsing badge so they pop.
 *  - Each card deep-links to /matches/{id} (SSR page, SEO-friendly).
 *  - Hidden entirely when there are no matches (no empty bar).
 *  - Hidden during the very first load to avoid an empty-bar flash; once
 *    data arrives it either renders cards or stays hidden if zero matches.
 */
export function LiveScoreTicker() {
  const { data: matches, loading } = useMatches()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  /* Sort: live first, then recent completed (last 5d), then upcoming (next 7d).
     Capped to 14 cards so the strip never gets absurdly long. */
  const sorted = useMemo(() => {
    if (!matches?.length) return []
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const live = matches.filter((m) => m.status === "live")
    const recent = matches
      .filter(
        (m) =>
          m.status === "completed" &&
          new Date(m.startDate).getTime() > now - 5 * dayMs,
      )
      .sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      )
    const upcoming = matches
      .filter(
        (m) =>
          m.status === "upcoming" &&
          new Date(m.startDate).getTime() < now + 7 * dayMs,
      )
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
    return [...live, ...recent, ...upcoming].slice(0, 14)
  }, [matches])

  const liveCount = sorted.filter((m) => m.status === "live").length

  /* Update arrow visibility on scroll / resize / data change. */
  const updateArrows = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => updateArrows()
    el.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", updateArrows)
    return () => {
      el.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", updateArrows)
    }
  }, [sorted])

  /* Auto-scroll every 4s — pause on hover, skip if <=1 card. */
  useEffect(() => {
    if (hovered || sorted.length <= 1) return
    const id = setInterval(() => {
      const el = scrollRef.current
      if (!el) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const next = el.scrollLeft + 250 // ~one card width
      if (next >= max - 4) {
        el.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        el.scrollTo({ left: next, behavior: "smooth" })
      }
    }, 4000)
    return () => clearInterval(id)
  }, [hovered, sorted.length])

  const scrollByCards = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 260, behavior: "smooth" })
  }

  /* Don't render until we have data — avoids an empty-bar flash on first
     paint. Once data arrives, either render the strip or stay hidden if
     there are genuinely zero matches to show. */
  if (loading && !matches) return null
  if (!sorted.length) return null

  return (
    <div
      className="border-b border-border/80 bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:sticky lg:top-14 lg:z-40"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Live matches ticker"
    >
      <div className="mx-auto flex max-w-7xl items-stretch px-1 sm:px-3">
        {/* Brand label — left side (hidden on xs to save space) */}
        <a
          href="/?view=matches"
          className="hidden shrink-0 flex-col justify-center border-r border-white/10 bg-gradient-to-b from-[#1e2a5e] to-[#16224d] px-2.5 text-white transition-opacity hover:opacity-90 sm:flex"
          aria-label="View all live scores"
        >
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest">
              Live
            </span>
          </div>
          <span className="mt-0.5 text-[9px] font-medium leading-none text-white/60">
            {liveCount > 0 ? `${liveCount} match${liveCount === 1 ? "" : "es"}` : "Scores"}
          </span>
        </a>

        {/* Cards strip — flanked by chevron arrows on desktop */}
        <div className="relative min-w-0 flex-1">
          {/* Left arrow */}
          <button
            type="button"
            aria-label="Scroll matches left"
            onClick={() => scrollByCards(-1)}
            className={cn(
              "absolute left-0 top-1/2 z-10 hidden h-full -translate-y-1/2 items-center justify-center px-1 lg:flex",
              !canLeft && "pointer-events-none opacity-0",
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-background shadow-md ring-1 ring-border transition-colors hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </span>
          </button>

          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto px-1.5 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollSnapType: "x proximity" }}
          >
            {sorted.map((m) => (
              <TickerCard key={m.id} match={m} />
            ))}
          </div>

          {/* Right arrow */}
          <button
            type="button"
            aria-label="Scroll matches right"
            onClick={() => scrollByCards(1)}
            className={cn(
              "absolute right-0 top-1/2 z-10 hidden h-full -translate-y-1/2 items-center justify-center px-1 lg:flex",
              !canRight && "pointer-events-none opacity-0",
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-background shadow-md ring-1 ring-border transition-colors hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Card                                                                */
/* ------------------------------------------------------------------ */

/** A single match card in the ticker. Visual treatment adapts to status. */
function TickerCard({ match }: { match: Match }) {
  const t1 = match.team1
  const t2 = match.team2
  const t1Inn = lastInnings(match, match.team1Id)
  const t2Inn = lastInnings(match, match.team2Id)
  const live = match.status === "live"
  const completed = match.status === "completed"
  const href = `/matches/${match.id}`

  // Which team is batting right now? = the team in the latest innings.
  const battingNowId =
    live && match.scorecard?.innings?.length
      ? match.scorecard.innings[match.scorecard.innings.length - 1].teamId
      : null

  // Latest innings for CRR display (the one currently in progress when live)
  const currentInn = live && match.scorecard?.innings?.length
    ? match.scorecard.innings[match.scorecard.innings.length - 1]
    : null

  return (
    <a
      href={href}
      className={cn(
        "group block w-[228px] shrink-0 snap-start rounded-lg border bg-card p-2.5 text-left transition-all duration-150",
        live
          ? "border-l-2 border-l-red-500 hover:border-red-400 hover:shadow-md"
          : "hover:border-red-300/70 hover:shadow-sm",
      )}
      style={{ scrollSnapAlign: "start" }}
    >
      {/* Header row — status pill + format/series */}
      <div className="mb-1.5 flex items-center justify-between gap-1">
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Live
          </span>
        ) : completed ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            Result
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
            Upcoming
          </span>
        )}
        <span className="truncate text-[9px] font-medium text-muted-foreground">
          {match.format}
          {match.series?.shortName ? ` · ${match.series.shortName}` : ""}
        </span>
      </div>

      {/* Team rows */}
      <TeamRow
        team={t1}
        innings={t1Inn}
        batting={live && battingNowId === match.team1Id}
      />
      <TeamRow
        team={t2}
        innings={t2Inn}
        batting={live && battingNowId === match.team2Id}
      />

      {/* Context line */}
      <div className="mt-1.5 truncate border-t border-border/50 pt-1 text-[9px] text-muted-foreground">
        {live ? (
          currentInn ? (
            <span>
              CRR{" "}
              <span className="font-bold tabular-nums text-foreground">
                {crr(currentInn.totalRuns, currentInn.totalOvers)}
              </span>{" "}
              · {currentInn.teamShortName || "batting"}
            </span>
          ) : (
            "Innings starting…"
          )
        ) : completed ? (
          match.result || "Completed"
        ) : (
          formatMatchDate(match.startDate)
        )}
      </div>
    </a>
  )
}

function TeamRow({
  team,
  innings,
  batting,
}: {
  team?: Match["team1"]
  innings: { totalRuns: number; totalWickets: number; totalOvers: string } | null
  batting?: boolean
}) {
  if (!team) return null
  return (
    <div className="flex items-center justify-between gap-1.5 py-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <TeamBadge team={team} size="sm" />
        <span className="truncate text-[11px] font-semibold">
          {team.name}
        </span>
        {batting && (
          <span
            className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-red-600"
            aria-label="currently batting"
          />
        )}
      </div>
      {innings ? (
        <span className="shrink-0 text-[13px] font-extrabold tabular-nums">
          {innings.totalRuns}/{innings.totalWickets}
          {innings.totalOvers && (
            <span className="ml-0.5 text-[9px] font-medium text-muted-foreground">
              ({innings.totalOvers})
            </span>
          )}
        </span>
      ) : (
        <span className="shrink-0 text-[9px] text-muted-foreground">—</span>
      )}
    </div>
  )
}
