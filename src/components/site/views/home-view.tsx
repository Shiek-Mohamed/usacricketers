"use client"

import { useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { useMatches, useArticles } from "@/lib/use-data"
import type { Match } from "@/lib/types"
import {
  TeamBadge,
  StatusPill,
  FormatPill,
  formatMatchDate,
  formatMatchTime,
} from "@/components/cricket/ui"
import { MiniScorecard } from "@/components/cricket/mini-scorecard"
import { ArticleCard } from "@/components/cricket/article-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, Radio, CalendarClock, Newspaper, Trophy } from "lucide-react"

function SectionTitle({
  title,
  actionLabel,
  onAction,
  icon: Icon,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ElementType
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-red-600" aria-hidden />
        {Icon && <Icon className="h-4 w-4 text-red-600" />}
        <h2 className="text-sm font-extrabold uppercase tracking-tight sm:text-base">
          {title}
        </h2>
      </div>
      {actionLabel && onAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          className="h-7 gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

function HeroMatch({ match }: { match: Match }) {
  const navigate = useAppStore((s) => s.navigate)
  const live = match.status === "live"
  const sc = match.scorecard
  const t1 = match.team1
  const t2 = match.team2

  const t1Innings = sc?.innings?.filter((i) => i.teamId === match.team1Id) ?? []
  const t2Innings = sc?.innings?.filter((i) => i.teamId === match.team2Id) ?? []

  return (
    <Card
      className={`overflow-hidden p-0 ${
        live ? "ring-2 ring-red-500/40" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate text-xs text-muted-foreground">
            {match.matchNo}
            {match.series?.shortName ? ` · ${match.series.shortName}` : ""}
          </span>
        </div>
        <StatusPill status={match.status} />
      </div>
      <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6">
        {[t1, t2].map((team, idx) => {
          if (!team) return null
          const innings = idx === 0 ? t1Innings : t2Innings
          return (
            <div
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <TeamBadge team={team} size="lg" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold sm:text-base">
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
                      className="text-lg font-extrabold tabular-nums sm:text-xl"
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
      </CardContent>
      <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
        <span className="font-medium text-foreground">{match.venue}</span>
        {match.city ? `, ${match.city}` : ""} ·{" "}
        {formatMatchDate(match.startDate)} · {formatMatchTime(match.startDate)}
        {match.result ? (
          <span className="mt-1 block text-emerald-700 font-semibold">
            {match.result}
          </span>
        ) : null}
      </div>
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <Button
          onClick={() => navigate("match-detail", match.id)}
          className="w-full gap-1.5 bg-red-600 text-white hover:bg-red-700 sm:w-auto"
        >
          View Scorecard
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

function HeroSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <Skeleton className="h-10 w-full rounded-none" />
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      <div className="px-6 pb-6">
        <Skeleton className="h-9 w-full sm:w-40" />
      </div>
    </Card>
  )
}

function TopStoriesSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="mb-4 h-4 w-24" />
      <div className="space-y-4">
        <Skeleton className="aspect-[16/9] w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <div className="space-y-2 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </Card>
  )
}

export function HomeView() {
  const navigate = useAppStore((s) => s.navigate)
  const { data: matchesData, loading: matchesLoading } = useMatches()
  const { data: featuredArticles, loading: articlesLoadingFeatured } =
    useArticles({ featured: true })
  const { data: allArticles, loading: articlesLoadingAll } = useArticles()

  const matches = matchesData ?? []
  const liveMatch = matches.find((m) => m.status === "live")
  const heroMatch =
    liveMatch ??
    matches.find((m) => m.status === "completed") ??
    matches[0] ??
    null

  const completedMatches = useMemo(
    () =>
      matches
        .filter((m) => m.status === "completed")
        .slice(0, 6),
    [matches]
  )
  const upcomingMatches = useMemo(
    () => matches.filter((m) => m.status === "upcoming").slice(0, 6),
    [matches]
  )

  const topFeatured =
    featuredArticles && featuredArticles.length > 0
      ? featuredArticles
      : allArticles ?? []
  const topStory = topFeatured[0] ?? null
  const moreStories = topFeatured.slice(1, 5)
  const latestNews = (allArticles ?? []).slice(0, 8)

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero / Top section */}
      <section>
        <SectionTitle
          title={liveMatch ? "Live & Recent" : "Featured Match"}
          icon={Radio}
          actionLabel="All matches"
          onAction={() => navigate("matches")}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2">
            {matchesLoading ? (
              <HeroSkeleton />
            ) : heroMatch ? (
              <HeroMatch match={heroMatch} />
            ) : (
              <Card className="grid h-full min-h-[200px] place-items-center p-6">
                <p className="text-sm text-muted-foreground">
                  No matches available.
                </p>
              </Card>
            )}
          </div>
          <div className="lg:col-span-1">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-red-600" />
                <h3 className="text-sm font-extrabold uppercase tracking-tight">
                  Top Stories
                </h3>
              </div>
              {articlesLoadingFeatured && articlesLoadingAll ? (
                <TopStoriesSkeleton />
              ) : topStory ? (
                <div className="space-y-4">
                  <ArticleCard article={topStory} variant="featured" />
                  {moreStories.length > 0 && (
                    <div className="space-y-3 border-t pt-3">
                      {moreStories.map((a) => (
                        <ArticleCard
                          key={a.id}
                          article={a}
                          variant="compact"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No stories available.
                </p>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Latest Results */}
      {completedMatches.length > 0 && (
        <section>
          <SectionTitle
            title="Latest Results"
            icon={Trophy}
            actionLabel="All matches"
            onAction={() => navigate("matches")}
          />
          <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
            {matchesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-40 w-72 shrink-0 rounded-lg"
                  />
                ))
              : completedMatches.map((m) => (
                  <div key={m.id} className="w-72 shrink-0">
                    <MiniScorecard match={m} />
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <section>
          <SectionTitle
            title="Upcoming Matches"
            icon={CalendarClock}
            actionLabel="Full schedule"
            onAction={() => navigate("schedule")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchesLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-lg" />
                ))
              : upcomingMatches.map((m) => (
                  <MiniScorecard key={m.id} match={m} />
                ))}
          </div>
        </section>
      )}

      {/* Latest News */}
      <section>
        <SectionTitle
          title="Latest News"
          icon={Newspaper}
          actionLabel="View all"
          onAction={() => navigate("news")}
        />
        {articlesLoadingAll ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[16/9] w-full rounded-lg" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : latestNews.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {latestNews.map((a) => (
              <ArticleCard key={a.id} article={a} variant="default" />
            ))}
          </div>
        ) : (
          <Card className="grid place-items-center p-6">
            <p className="text-sm text-muted-foreground">No news yet.</p>
          </Card>
        )}
      </section>
    </div>
  )
}
