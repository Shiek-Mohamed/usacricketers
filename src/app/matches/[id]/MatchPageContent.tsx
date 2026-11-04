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
import { RecentResultsWidget } from "@/components/site/sidebar-widgets"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { ShareButtons } from "@/components/site/share-buttons"
import { LiveMatchSection } from "@/components/site/live-match-section"
import { Card } from "@/components/ui/card"
import {
  ChevronRight,
  MapPin,
  CalendarDays,
  Home as HomeIcon,
  Trophy,
  Users,
  User,
  Shield,
  Award,
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

/** Full match scorebox with scores + all match details in one compact card */
function MatchScorebox({ match }: { match: Match }) {
  const sc = match.scorecard
  const live = match.status === "live"
  const t1 = match.team1
  const t2 = match.team2
  const t1Innings = sc?.innings?.filter((i) => i.teamId === match.team1Id) ?? []
  const t2Innings = sc?.innings?.filter((i) => i.teamId === match.team2Id) ?? []

  return (
    <Card className={`overflow-hidden border-2 p-0 ${live ? "border-red-500/60 ring-2 ring-red-500/20" : "border-border"}`}>
      {/* Navy header bar */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#1e2a5e] to-[#2d3b7a] px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate text-sm font-bold text-white">{match.matchNo}</span>
          {match.series?.shortName && (
            <span className="hidden text-xs text-white/70 sm:inline">· {match.series.shortName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ShareButtons title={`${t1?.shortName ?? "?"} vs ${t2?.shortName ?? "?"} — ${match.matchNo}`} className="flex" />
          <StatusPill status={match.status} />
        </div>
      </div>

      {/* Two-column layout: scores on left, details on right */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]">
        {/* LEFT: Team scores */}
        <div className="divide-y divide-border/40">
          {[t1, t2].map((team, idx) => {
            if (!team) return null
            const innings = idx === 0 ? t1Innings : t2Innings
            return (
              <a
                key={team.id}
                href={`/teams/${team.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/30 sm:px-6"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TeamBadge team={team} size="lg" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-bold sm:text-lg">{team.name}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{team.shortName}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {innings.length > 0 ? (
                    innings.map((inn, i) => (
                      <div key={i} className="text-xl font-extrabold tabular-nums sm:text-2xl">
                        {inn.totalRuns}/{inn.totalWickets}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">({inn.totalOvers} ov)</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Yet to bat</div>
                  )}
                </div>
              </a>
            )
          })}

          {/* Result banner (if completed) */}
          {match.result && (
            <div className="bg-emerald-50 px-4 py-2.5 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{match.result}</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Match Details panel */}
        <div className="border-t border-border/40 bg-muted/20 px-4 py-3 lg:border-l lg:border-t-0 sm:px-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Match Details
          </h3>
          <div className="space-y-0.5">
            <DetailRow icon={Trophy} label="Series" value={match.series?.name} />
            <DetailRow icon={Award} label="Format" value={match.format} />
            <DetailRow icon={CalendarDays} label="Season" value={match.series?.season} />
            <DetailRow icon={MapPin} label="Venue" value={match.venue ? `${match.venue}${match.city ? `, ${match.city}` : ""}` : null} />
            <DetailRow icon={CalendarDays} label="Date" value={`${formatMatchDate(match.startDate)} · ${formatMatchTime(match.startDate)}`} />
            <DetailRow icon={User} label="Player of the Match" value={match.manOfMatch} />
            <DetailRow icon={Users} label="Umpires" value={match.umpires} />
            <DetailRow icon={Users} label="TV Umpire" value={match.tvUmpire} />
            <DetailRow icon={Shield} label="Match Referee" value={match.referee} />
          </div>
        </div>
      </div>
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
            header={
              <>
                <MatchBreadcrumbs match={match} />
                <MatchScorebox match={match} />
              </>
            }
            sidebar={
              <>
                {recent.length > 0 && <RecentResultsWidget matches={recent} />}
                <CustomSidebarBlocks placement="match" />
              </>
            }
          >
            <div className="space-y-4">
              {/* Live commentary section — shown only when the match is live.
                  Connects to the WebSocket via useLiveScore so viewers see
                  real-time score updates + ball-by-ball commentary directly
                  on this page, without needing to click through to the live
                  blog. */}
              {match.status === "live" && (
                <LiveMatchSection matchId={match.id} />
              )}

              {match.scorecard ? (
                <ScorecardView scorecard={match.scorecard} />
              ) : (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  Scorecard not yet available for this match.
                </Card>
              )}

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
