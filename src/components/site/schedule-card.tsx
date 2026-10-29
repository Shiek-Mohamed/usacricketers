"use client"

/**
 * MatchCard — reusable team-vs-team matchup card for the Schedule page and
 * (later) the series-detail sidebar.
 *
 * Visual contract (per Task 5 spec):
 *   ┌─[4px team1.primaryColor strip]────────────────────────────────────────────┐
 *   │                                       [TODAY] / [LIVE•] / [RESULT]         │
 *   │  ┌─────┐   [TEST] 1st Match · IND v ENG 2025                              │
 *   │  │ 23  │                                                                  │
 *   │  │ OCT │   [IND] INDIA        VS        SRI LANKA    [SL]                │
 *   │  │ FRI │                                                                  │
 *   │  └─────┘   (Starts in 2h 15m — only if upcoming)                         │
 *   │                                                                          │
 *   │           📍 Multan Cricket Stadium, Multan · 09:00 local                │
 *   │           (result preview if completed)                                  │
 *   │           (ENG lead 1-0 — series progress badge if applicable)           │
 *   │                                          [📅 Add to Calendar]            │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 * Click anywhere on the card to navigate to the match detail view. The
 * "Add to Calendar" button stops propagation so it doesn't trigger navigation.
 */

import { useRef } from "react"
import type { Match } from "@/lib/types"
import {
  getStatusPill,
  getCountdown,
  getSeriesProgress,
  addToCalendar,
  getResultSummary,
} from "@/lib/match-utils"
import { useAppStore } from "@/lib/store"
import { TeamBadge, FormatPill, formatMatchTime } from "@/components/cricket/ui"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CalendarPlus, MapPin } from "lucide-react"

const STATUS_PILL_STYLES: Record<
  "red" | "amber" | "emerald" | "slate",
  string
> = {
  red: "bg-red-100 text-red-700 border-red-300",
  amber: "bg-amber-100 text-amber-700 border-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-300",
  slate: "bg-slate-100 text-slate-600 border-slate-300",
}

function dayNumber(iso: string): number {
  return new Date(iso).getDate()
}

function shortMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short" })
}

function weekdayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short" })
}

export interface MatchCardProps {
  match: Match
  /**
   * Compact variant for sidebar widgets: hides the countdown, result preview,
   * series-progress badge and the "Add to Calendar" button.
   */
  compact?: boolean
  /**
   * Full matches list — needed to compute a series scoreline. Optional; if not
   * supplied, the series-progress badge simply won't render.
   */
  allMatches?: Match[] | null
}

export function MatchCard({
  match,
  compact = false,
  allMatches,
}: MatchCardProps) {
  const navigate = useAppStore((s) => s.navigate)
  const anchorRef = useRef<HTMLAnchorElement | null>(null)

  const status = getStatusPill(match)
  const countdown = compact ? null : getCountdown(match)
  const result = compact ? null : getResultSummary(match)
  const seriesProgress = compact ? null : getSeriesProgress(match, allMatches)

  const t1 = match.team1
  const t2 = match.team2

  const handleNavigate = () => {
    navigate("match-detail", match.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleNavigate()
    }
  }

  const handleCalendarClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const blob = addToCalendar(match)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.rel = "noopener"
    const fname = `${t1?.shortName ?? "team1"}-vs-${
      t2?.shortName ?? "team2"
    }-${new Date(match.startDate).toISOString().slice(0, 10)}.ics`
    a.download = fname
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoke a beat later so the browser has a chance to fetch the blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${t1?.name ?? "Team 1"} vs ${t2?.name ?? "Team 2"}, ${
        match.format
      } ${match.matchNo}, ${status.label}`}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative cursor-pointer overflow-hidden border-l-4 p-4 transition-all",
        "hover:shadow-md hover:border-foreground/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        compact && "p-3"
      )}
      style={{
        borderLeftColor: t1?.primaryColor ?? "var(--color-border)",
      }}
    >
      {/* Status pill — absolute, top-right */}
      <span
        role="status"
        aria-label={`Status: ${status.label}`}
        className={cn(
          "pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm",
          STATUS_PILL_STYLES[status.color]
        )}
      >
        {status.pulse && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600"
          />
        )}
        {status.label}
      </span>

      {/* Body: date tile on the left, matchup + meta on the right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {/* Date tile — 56x56 with day / month band / weekday */}
        <div
          className="grid h-14 w-14 shrink-0 grid-rows-[1fr_14px_14px] overflow-hidden rounded-lg border bg-muted/40 text-center"
          aria-hidden="true"
        >
          <div className="flex items-center justify-center text-2xl font-extrabold leading-none tabular-nums">
            {dayNumber(match.startDate)}
          </div>
          <div className="bg-muted px-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">
            {shortMonth(match.startDate)}
          </div>
          <div className="px-1 text-[9px] font-semibold uppercase text-muted-foreground">
            {weekdayShort(match.startDate)}
          </div>
        </div>

        {/* Right column */}
        <div className="min-w-0 flex-1 space-y-2 pr-14">
          {/* Header row: format pill + match number + series shortName */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FormatPill format={match.format} />
            <span className="text-xs text-muted-foreground">
              {match.matchNo}
            </span>
            {match.series?.shortName && (
              <span className="truncate text-xs text-muted-foreground">
                · {match.series.shortName}
              </span>
            )}
          </div>

          {/* Matchup: team1 (left) | VS (centre) | team2 (right) */}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Team 1 */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {t1 && <TeamBadge team={t1} size="md" />}
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold uppercase tracking-tight">
                  {t1?.shortName ?? "T1"}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {t1?.name ?? ""}
                </div>
              </div>
            </div>

            {/* VS divider */}
            <div className="flex items-center justify-center px-1 sm:px-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80">
                VS
              </span>
            </div>

            {/* Team 2 — mirrored layout (badge on the right, text right-aligned) */}
            <div className="flex min-w-0 flex-1 items-center justify-start gap-2 sm:justify-end">
              {t2 && (
                <div className="min-w-0 text-right">
                  <div className="truncate text-sm font-extrabold uppercase tracking-tight">
                    {t2?.shortName ?? "T2"}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {t2?.name ?? ""}
                  </div>
                </div>
              )}
              {t2 && <TeamBadge team={t2} size="md" />}
            </div>
          </div>

          {/* Countdown — only for upcoming matches */}
          {countdown && (
            <div className="text-xs font-semibold text-amber-600">
              Starts {countdown}
            </div>
          )}

          {/* Result preview — only for completed matches with a scorecard */}
          {result && (
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t1?.shortName ?? "T1"} {result.team1Innings}
              </span>
              <span className="mx-1 text-muted-foreground/60">—</span>
              <span className="font-semibold text-foreground">
                {t2?.shortName ?? "T2"} {result.team2Innings}
              </span>
              {match.result && (
                <>
                  <span className="mx-1 text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">{match.result}</span>
                </>
              )}
            </div>
          )}

          {/* Meta: venue + local time */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {match.venue}
                {match.city ? `, ${match.city}` : ""}
              </span>
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span className="whitespace-nowrap">
              {formatMatchTime(match.startDate)} local
            </span>
          </div>

          {/* Series progress badge */}
          {seriesProgress && (
            <div>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold uppercase tracking-wide"
              >
                {seriesProgress.summary}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Add-to-Calendar (only for upcoming matches, non-compact) */}
      {!compact && match.status === "upcoming" && (
        <div className="mt-3 flex justify-end border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCalendarClick}
            aria-label={`Add ${t1?.shortName ?? "Team 1"} vs ${
              t2?.shortName ?? "Team 2"
            } to calendar`}
            className="h-8 gap-1.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Add to Calendar
          </Button>
        </div>
      )}

      {/* Hidden anchor kept around in case we ever want to wire download via
          state instead of an imperative <a>.click() — currently unused. */}
      <a
        ref={anchorRef}
        href="#"
        download={`${t1?.shortName ?? "match"}.ics`}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </Card>
  )
}
