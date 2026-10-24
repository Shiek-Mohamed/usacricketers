"use client"

import { useAppStore } from "@/lib/store"
import { useMatch } from "@/lib/use-data"
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
import { useLiveScore } from "@/lib/use-live-score"
import { stateToScorecard } from "@/lib/scoring"
import { useMatches } from "@/lib/use-data"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ChevronLeft,
  MapPin,
  Trophy,
  CalendarDays,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ShareButtons } from "@/components/site/share-buttons"

function MatchHeaderCard({ match }: { match: Match }) {
  const sc = match.scorecard
  const live = match.status === "live"
  const t1 = match.team1
  const t2 = match.team2

  const t1Innings = sc?.innings?.filter((i) => i.teamId === match.team1Id) ?? []
  const t2Innings = sc?.innings?.filter((i) => i.teamId === match.team2Id) ?? []

  return (
    <Card className={`overflow-hidden p-0 ${live ? "ring-2 ring-red-500/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate text-sm font-semibold">
            {match.matchNo}
          </span>
          <span className="text-xs text-muted-foreground">
            {match.series?.shortName || match.series?.name || ""}
          </span>
        </div>
        <StatusPill status={match.status} />
      </div>

      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {[t1, t2].map((team, idx) => {
            if (!team) return null
            const innings = idx === 0 ? t1Innings : t2Innings
            return (
              <div
                key={team.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card/40 p-3 sm:p-4"
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
                <div className="text-right">
                  {innings.length > 0 ? (
                    innings.map((inn, i) => (
                      <div
                        key={i}
                        className="text-xl font-extrabold tabular-nums sm:text-2xl"
                      >
                        {inn.totalRuns}/{inn.totalWickets}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({inn.totalOvers} ov)
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Yet to bat
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {match.venue}
            {match.city ? `, ${match.city}` : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatMatchDate(match.startDate)} · {formatMatchTime(match.startDate)}
          </span>
        </div>

        {!sc && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Match yet to begin / Scorecard will be available once play starts.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MatchDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Card className="overflow-hidden p-0">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="grid gap-4 p-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-6 w-3/4 mx-6" />
      </Card>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function MatchDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data, loading, error } = useMatch(id)
  const { data: allMatches } = useMatches()
  const { liveState, connected } = useLiveScore(id)

  if (loading) return <MatchDetailSkeleton />

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("matches")}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to matches
        </Button>
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Unable to load match</AlertTitle>
          <AlertDescription>
            {error || "Match not found. It may have been removed."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const match = data
  // When a live scoring session is broadcasting, prefer the live scorecard +
  // status over the persisted DB copy so this public view updates instantly.
  const match_ = liveState
    ? {
        ...match,
        scorecard: stateToScorecard(liveState),
        status: liveState.status,
        result: liveState.result || match.result,
      }
    : match
  const sc = match_.scorecard
  const isLive = match_.status === "live"

  return (
    <InnerPageLayout
      sidebar={
        <>
          <MatchInfoWidget match={match_} />
          <RecentResultsWidget matches={allMatches ?? []} />
          <CustomSidebarBlocks placement="match" />
        </>
      }
    >
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("matches")}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to matches
        </Button>

        <MatchHeaderCard match={match_} />

        {isLive && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-red-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-red-700">
              Live scoring in progress
            </span>
            {connected && (
              <span className="text-[11px] text-red-600/80">· connected</span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              Updates in real time as balls are scored
            </span>
          </div>
        )}

        {match_.status === "completed" && match_.result && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <Trophy className="h-4 w-4" /> Result
              </div>
              <ShareButtons title={`${match_.team1?.shortName} vs ${match_.team2?.shortName} — ${match_.matchNo}`} />
            </div>
            <p className="mt-1 text-sm font-semibold">{match_.result}</p>
            {match_.manOfMatch && (
              <p className="mt-1 text-sm text-emerald-700">
                <span className="font-bold">Player of the Match:</span> {match_.manOfMatch}
              </p>
            )}
            {/* Match officials — umpires + TV umpire + referee */}
            {(match_.umpires || match_.tvUmpire || match_.referee) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {match_.umpires && (
                  <span>
                    <span className="font-semibold">Umpires:</span>{" "}
                    {match_.umpires}
                  </span>
                )}
                {match_.tvUmpire && (
                  <span>
                    <span className="font-semibold">TV:</span>{" "}
                    {match_.tvUmpire}
                  </span>
                )}
                {match_.referee && (
                  <span>
                    <span className="font-semibold">Referee:</span>{" "}
                    {match_.referee}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scorecard */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-red-600" />
            <h2 className="text-sm font-extrabold uppercase tracking-tight sm:text-base">
              Full Scorecard
            </h2>
          </div>
          {sc ? (
            <ScorecardView scorecard={sc} />
          ) : (
            <Card className="grid place-items-center p-6">
              <p className="text-sm text-muted-foreground">
                Scorecard will be available once the match begins.
              </p>
            </Card>
          )}
        </section>

        {/* Commentary feed */}
        {sc?.commentary && sc.commentary.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-red-600" />
              <h2 className="text-sm font-extrabold uppercase tracking-tight sm:text-base">
                Commentary
              </h2>
            </div>
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="max-h-80 space-y-1 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                {sc.commentary.map((c) => (
                  <div key={c.id} className="flex gap-2 text-sm">
                    <span className="w-12 shrink-0 font-mono tabular-nums text-muted-foreground">
                      {c.over}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1",
                        c.kind === "wicket" && "font-bold text-red-700",
                        c.kind === "six" && "font-bold text-purple-700",
                        c.kind === "boundary" && "font-bold text-emerald-700",
                        c.kind === "over" && "font-semibold text-foreground",
                        c.kind === "info" && "italic text-muted-foreground",
                        c.kind === "dot" && "text-muted-foreground/70 tabular-nums"
                      )}
                    >
                      {c.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </InnerPageLayout>
  )
}
