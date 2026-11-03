"use client"

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
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { ShareButtons } from "@/components/site/share-buttons"
import { Card } from "@/components/ui/card"
import {
  ChevronRight,
  MapPin,
  CalendarDays,
  Radio,
  Home as HomeIcon,
  Trophy,
} from "lucide-react"

/**
 * SSR match detail page.
 *
 * Lives at /matches/[id] — the matching server component (`page.tsx` in this
 * directory) fetches the match + recent results from the DB at request time
 * and passes the serialized data in as props. NO client-side fetch happens
 * for the match itself — Google sees the full HTML in the initial response.
 *
 * Differences from the SPA `MatchDetailView`:
 *   • No `useAppStore` / `navigate()` — all links are real `<a href>`s so
 *     they trigger full page navigations (which is what we want for SEO).
 *   • No `useMatch()` hook — match data arrives as props from the server.
 *   • No `useLiveScore()` WebSocket hook — this page is for completed /
 *     upcoming matches. The SPA `MatchDetailView` remains the canonical
 *     "live" view and is reachable from `/?view=matches`.
 *   • Re-implements a clean match header inline (the SPA version's
 *     `MatchHeaderCard` is a local function in match-detail-view.tsx and
 *     pulls in live-scoring state, so it's simpler to re-implement here).
 */

/** Breadcrumb: Home > Matches > Team1 vs Team2 */
function MatchBreadcrumbs({ match }: { match: Match }) {
  const t1 = match.team1?.shortName ?? "Team 1"
  const t2 = match.team2?.shortName ?? "Team 2"
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
    >
      <a
        href="/"
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <HomeIcon className="h-3 w-3" />
        Home
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <a
        href="/?view=matches"
        className="transition-colors hover:text-foreground"
      >
        Matches
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <span className="line-clamp-1 max-w-[60%] truncate font-medium text-foreground/80">
        {t1} vs {t2}
      </span>
    </nav>
  )
}

/** Match header — a clean re-implementation of the SPA `MatchHeaderCard`
 *  with no live-scoring state. Renders the teams, their scores, venue, and
 *  date in a single Card. */
function MatchHeader({ match }: { match: Match }) {
  const sc = match.scorecard
  const live = match.status === "live"
  const t1 = match.team1
  const t2 = match.team2

  const t1Innings = sc?.innings?.filter((i) => i.teamId === match.team1Id) ?? []
  const t2Innings = sc?.innings?.filter((i) => i.teamId === match.team2Id) ?? []

  return (
    <Card
      className={`overflow-hidden border-2 p-0 ${
        live ? "border-red-500/60 ring-2 ring-red-500/20" : "border-border"
      }`}
    >
      {/* Header bar — format + match title + series on left, status on right */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/30 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate text-sm font-bold">{match.matchNo}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {match.series?.shortName || match.series?.name || ""}
          </span>
        </div>
        <StatusPill status={match.status} />
      </div>

      {/* Team rows — stacked, no inner borders, prominent scores */}
      <div className="divide-y divide-border/40">
        {[t1, t2].map((team, idx) => {
          if (!team) return null
          const innings = idx === 0 ? t1Innings : t2Innings
          return (
            <a
              key={team.id}
              href={`/teams/${team.id}`}
              className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-accent/30 sm:px-6"
            >
              <div className="flex items-center gap-3 min-w-0">
                <TeamBadge team={team} size="lg" />
                <div className="min-w-0">
                  <div className="truncate text-base font-bold sm:text-lg">
                    {team.name}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {team.shortName}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {innings.length > 0 ? (
                  innings.map((inn, i) => (
                    <div
                      key={i}
                      className="text-xl font-extrabold tabular-nums sm:text-2xl"
                    >
                      {inn.totalRuns}/{inn.totalWickets}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({inn.totalOvers} ov)
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">Yet to bat</div>
                )}
              </div>
            </a>
          )
        })}
      </div>

      {/* Footer — venue + date with icons */}
      <div className="border-t border-border/40 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {match.venue && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {match.venue}
              {match.city ? `, ${match.city}` : ""}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatMatchDate(match.startDate)} · {formatMatchTime(match.startDate)}
          </span>
        </div>
        {match.result && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Trophy className="h-3.5 w-3.5" />
            {match.result}
          </div>
        )}
        {!sc && !match.result && (
          <div className="mt-2 text-sm text-muted-foreground">
            Match yet to begin — scorecard will be available once play starts.
          </div>
        )}
      </div>
    </Card>
  )
}

export function MatchPageContent({
  match,
  recent,
}: {
  match: Match
  recent: Match[]
}) {
  const t1 = match.team1?.shortName ?? "Team 1"
  const t2 = match.team2?.shortName ?? "Team 2"
  const matchTitle = `${t1} vs ${t2} — ${match.matchNo}`

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <InnerPageLayout
            header={
              <>
                <MatchBreadcrumbs match={match} />

                {/* Title + share */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                    <Radio className="h-6 w-6 text-red-600" />
                    {t1} vs {t2}
                  </h1>
                  <ShareButtons title={matchTitle} />
                </div>

                <MatchHeader match={match} />
              </>
            }
            sidebar={
              <>
                <MatchInfoWidget match={match} />
                {recent.length > 0 && (
                  <RecentResultsWidget matches={recent} />
                )}
                <CustomSidebarBlocks placement="match" />
              </>
            }
          >
            <div className="space-y-5">
              {/* Scorecard */}
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <Trophy className="h-5 w-5 text-amber-600" />
                  Scorecard
                </h2>
                {match.scorecard ? (
                  <ScorecardView scorecard={match.scorecard} />
                ) : (
                  <Card className="p-6 text-center text-sm text-muted-foreground">
                    Scorecard not yet available for this match.
                  </Card>
                )}
              </div>

              {/* Recent results */}
              {recent.length > 0 && (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                    <CalendarDays className="h-5 w-5 text-emerald-600" />
                    Recent Results
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {recent.map((m) => (
                      <a
                        key={m.id}
                        href={`/matches/${m.id}`}
                        className="group flex flex-col rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold">
                            {m.team1?.shortName} v {m.team2?.shortName}
                          </span>
                          <FormatPill format={m.format} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs">
                          {m.result || formatMatchDate(m.startDate)}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* More matches — link to the SPA matches index */}
              <a
                href="/?view=matches"
                className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
                More matches
              </a>
            </div>
          </InnerPageLayout>
        </div>
      </main>
      <Footer />
    </div>
  )
}
