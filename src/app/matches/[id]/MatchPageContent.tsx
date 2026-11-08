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

/** Full match scorebox — Wisden-inspired dark navy gradient hero with
 *  symmetric team layout, big score numerals, "vs" divider, and a
 *  one-line status strip at the bottom. Match details go in a compact
 *  horizontal strip below the hero. */
function MatchScorebox({ match }: { match: Match }) {
  const sc = match.scorecard
  const live = match.status === "live"
  const t1 = match.team1
  const t2 = match.team2
  const t1Innings = sc?.innings?.filter((i) => i.teamId === match.team1Id) ?? []
  const t2Innings = sc?.innings?.filter((i) => i.teamId === match.team2Id) ?? []

  const statusLine = (() => {
    if (match.status === "completed" && match.result) return match.result
    if (match.status === "upcoming") return "Match yet to begin"
    if (!sc || (t1Innings.length === 0 && t2Innings.length === 0)) return "Innings setup in progress"
    const lastInn = sc.innings?.[sc.innings.length - 1]
    if (!lastInn) return "Live — scoring in progress"
    return `Live — ${lastInn.totalRuns}/${lastInn.totalWickets} (${lastInn.totalOvers} ov)`
  })()

  return (
    <div className={`overflow-hidden rounded-xl ${live ? "ring-2 ring-red-500/40" : ""}`}>
      {/* Top bar — format + match no + share + status */}
      <div className="flex items-center justify-between gap-2 bg-[#0f1729] px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate font-display text-sm font-bold uppercase tracking-wide text-white/90">{match.matchNo}</span>
          {match.series?.shortName && (
            <span className="hidden font-display text-xs font-medium uppercase tracking-wide text-white/50 sm:inline">· {match.series.shortName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ShareButtons title={`${t1?.shortName ?? "?"} vs ${t2?.shortName ?? "?"} — ${match.matchNo}`} className="flex" />
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
      </div>

      {/* Hero scoreboard — dark navy gradient with symmetric team layout */}
      <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] px-4 py-6 sm:px-6 sm:py-8">
        {/* Venue + date — small, centered */}
        <div className="mb-5 text-center text-xs text-white/50">
          {match.venue}{match.city ? `, ${match.city}` : ""} · {formatMatchDate(match.startDate)}
        </div>

        {/* Two teams symmetric — crests + scores + "vs" */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
          {/* Team 1 (left) */}
          <ScoreHeroSide team={t1} innings={t1Innings} align="left" />

          {/* VS divider */}
          <div className="text-xs font-bold uppercase tracking-widest text-white/30">vs</div>

          {/* Team 2 (right) */}
          <ScoreHeroSide team={t2} innings={t2Innings} align="right" />
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

      {/* Status strip — one-line summary */}
      <div className="bg-[#162244] px-4 py-2.5 text-center sm:px-6">
        <p className="text-sm font-semibold text-white/90">{statusLine}</p>
      </div>

      {/* Match details — compact horizontal strip below the hero */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 bg-muted/20 px-4 py-2.5 text-xs sm:px-6">
        {match.series?.name && (
          <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-muted-foreground" /> {match.series.name}</span>
        )}
        {match.series?.season && (
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> {match.series.season}</span>
        )}
        {match.manOfMatch && (
          <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-muted-foreground" /> POTM: {match.manOfMatch}</span>
        )}
        {match.umpires && (
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Umpires: {match.umpires}</span>
        )}
        {match.tvUmpire && (
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" /> TV: {match.tvUmpire}</span>
        )}
        {match.referee && (
          <span className="inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-muted-foreground" /> Referee: {match.referee}</span>
        )}
      </div>
    </div>
  )
}

/** One team's side of the hero scoreboard — crest + short name + score. */
function ScoreHeroSide({
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
      {/* Crest in a translucent circle */}
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 ring-2 ring-white/20 sm:h-14 sm:w-14">
        <TeamBadge team={team} size="md" />
      </div>
      {/* Team short name */}
      <div className="font-display text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm">
        {team.shortName}
      </div>
      {/* Score — massive numerals */}
      {hasScore ? (
        <div className="text-white">
          {innings.map((inn, i) => (
            <div key={i} className="font-display text-2xl font-extrabold tabular-nums sm:text-4xl">
              {inn.totalRuns}<span className="text-white/60">/{inn.totalWickets}</span>
            </div>
          ))}
          <div className="font-display text-xs font-normal text-white/50">
            ({innings[0].totalOvers} ov)
          </div>
        </div>
      ) : (
        <div className="font-display text-sm text-white/40">Yet to bat</div>
      )}
    </a>
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
