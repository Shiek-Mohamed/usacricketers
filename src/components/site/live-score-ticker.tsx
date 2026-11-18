"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMatches } from "@/lib/use-data"
import type { Match } from "@/lib/types"
import { TeamBadge } from "@/components/cricket/ui"
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
 * matches, rendered directly below the site Header on public pages.
 *
 * Design (matching the provided mockup):
 *  - Light-gray strip holding white, rounded match cards.
 *  - Each card: dark-green series header, thin divider, two team rows
 *    (flag + name + score OR date/time), and a "Match Centre" button.
 *  - No "Live" brand label / blue side block.
 *  - NOT sticky — scrolls away with the page.
 *  - Auto-scrolls one card every 4s; pauses on hover/focus.
 *  - Manual chevron arrows on lg+ screens.
 *  - Live matches still show live scores (runs/wickets); upcoming matches
 *    show date + time in the right column.
 *  - Hidden entirely when there are no matches (no empty bar).
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
      const next = el.scrollLeft + 300 // ~one card width
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
    el.scrollBy({ left: dir * 300, behavior: "smooth" })
  }

  /* Don't render until we have data — avoids an empty-bar flash on first
     paint. Once data arrives, either render the strip or stay hidden if
     there are genuinely zero matches to show. */
  if (loading && !matches) return null
  if (!sorted.length) return null

  return (
    <div
      className="border-b border-border/80 bg-muted/40"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Live matches ticker"
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-4">
        <div className="relative">
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
            className="flex gap-3 overflow-x-auto px-1 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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

/**
 * A single match card in the ticker — white rounded card matching the
 * provided mockup design.
 *
 * Layout (top → bottom):
 *   1. Series header (dark green, semi-bold) — series short name or format.
 *   2. Thin divider.
 *   3. Two team rows: flag + name (left), score or date/time (right).
 *      - Live / completed: each team's innings score (runs/wickets, overs).
 *      - Upcoming: match date on row 1, start time on row 2.
 *   4. Full-width "Match Centre" button linking to the match page.
 */
function TickerCard({ match }: { match: Match }) {
  const t1 = match.team1
  const t2 = match.team2
  const t1Inn = lastInnings(match, match.team1Id)
  const t2Inn = lastInnings(match, match.team2Id)
  const live = match.status === "live"
  const upcoming = match.status === "upcoming"
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

  // For upcoming matches: date (dd/mm/yy) on team-1 row, time (HH:MM) on team-2 row.
  const sd = new Date(match.startDate)
  const dateStr = sd.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
  const timeStr = sd.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  return (
    <div className="w-[280px] shrink-0 snap-start overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md sm:w-[300px]">
      {/* Series header */}
      <div className="truncate px-4 pt-3 pb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-400">
        {match.series?.shortName || match.series?.name || match.format}
      </div>

      {/* Divider */}
      <div className="border-t border-border/60" />

      {/* Team rows */}
      <div className="space-y-2 px-4 py-3">
        <TeamRow
          team={t1}
          innings={t1Inn}
          batting={live && battingNowId === match.team1Id}
          rightText={upcoming ? dateStr : undefined}
        />
        <TeamRow
          team={t2}
          innings={t2Inn}
          batting={live && battingNowId === match.team2Id}
          rightText={upcoming ? timeStr : undefined}
        />

        {/* Context line: CRR for live, result for completed, nothing extra for upcoming */}
        {(live || match.status === "completed") && (
          <div className="truncate pt-1 text-[11px] text-muted-foreground">
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
            ) : (
              match.result || "Completed"
            )}
          </div>
        )}
      </div>

      {/* Match Centre button */}
      <div className="px-3 pb-3">
        <a
          href={href}
          className="block rounded-lg bg-muted py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
        >
          Match Centre
        </a>
      </div>
    </div>
  )
}

function TeamRow({
  team,
  innings,
  batting,
  rightText,
}: {
  team?: Match["team1"]
  innings: { totalRuns: number; totalWickets: number; totalOvers: string } | null
  batting?: boolean
  /** Right-column text for upcoming matches (date or time). Ignored when innings exist. */
  rightText?: string
}) {
  if (!team) return null
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <TeamBadge team={team} size="sm" />
        <span className="truncate text-sm font-medium text-foreground">
          {team.name}
        </span>
        {batting && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-600"
            aria-label="currently batting"
          />
        )}
      </div>
      {innings ? (
        <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
          {innings.totalRuns}/{innings.totalWickets}
          {innings.totalOvers && (
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              ({innings.totalOvers})
            </span>
          )}
        </span>
      ) : rightText ? (
        <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
          {rightText}
        </span>
      ) : (
        <span className="shrink-0 text-sm text-muted-foreground">—</span>
      )}
    </div>
  )
}
