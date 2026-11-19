"use client"

import { useMemo } from "react"
import { ArrowLeft, CalendarDays, Trophy, BarChart3 } from "lucide-react"
import { useSeriesItem, useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { StatusPill, formatMatchDate, TeamBadge } from "@/components/cricket/ui"
import { MiniScorecard } from "@/components/cricket/mini-scorecard"
import { Standings } from "@/components/cricket/standings"
import { SeriesHighlights } from "@/components/cricket/series-highlights"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import {
  SeriesInfoWidget,
  SeriesMatchesWidget,
} from "@/components/site/sidebar-widgets"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Users, CalendarDays as CalIcon } from "lucide-react"
import type { Match, Scorecard, Team } from "@/lib/types"

export function SeriesDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data: series, loading: seriesLoading } = useSeriesItem(id)
  const { data: matches, loading: matchesLoading } = useMatches()

  const seriesMatches = useMemo(() => {
    if (!matches || !id) return []
    return matches
      .filter((m) => m.seriesId === id)
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
  }, [matches, id])

  // Teams participating in this series — derived from the matches (team1 +
  // team2), since the TournamentTeam association isn't always populated.
  const seriesTeams = useMemo(() => {
    const map = new Map<string, Team>()
    for (const m of seriesMatches) {
      if (m.team1) map.set(m.team1.id, m.team1)
      if (m.team2) map.set(m.team2.id, m.team2)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [seriesMatches])

  if (seriesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!series) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Series not found.{" "}
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => navigate("series")}
          >
            Back to series
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <InnerPageLayout
      sidebar={
        <>
          <SeriesInfoWidget series={series} />
          {seriesMatches.length > 0 && (
            <SeriesMatchesWidget matches={seriesMatches} />
          )}
          <CustomSidebarBlocks placement="series" />
        </>
      }
    >
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("series")}>
          <ArrowLeft className="size-4" /> Back to Series
        </Button>

        {/* Dark navy hero — series profile card */}
        <div className="overflow-hidden rounded-xl dark:ring-1 dark:ring-white/10">
          <div className="flex items-center justify-between gap-2 bg-[#0f1729] dark:bg-[#0d1525] dark:bg-[#0d1525] px-4 py-2 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-white/50">{series.format}</span>
              <StatusPill status={series.status} />
            </div>
            <span className="text-xs text-white/50">{series.season}</span>
          </div>

          <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] dark:from-[#1e2a5e] dark:to-[#1a2540] px-4 py-6 sm:px-6 sm:py-8">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-4 sm:text-left">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 ring-4 ring-white/20">
                <Trophy className="h-8 w-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{series.name}</h1>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-white/70 sm:justify-start">
                  <span className="font-bold uppercase tracking-wide">{series.format}</span>
                  <span className="text-white/30">·</span>
                  <span>{series.season}</span>
                  <span className="text-white/30">·</span>
                  <span>{seriesMatches.length} matches</span>
                </div>
                {series.description && (
                  <p className="mt-2 max-w-xl text-sm text-white/50">{series.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#162244] dark:bg-[#1a2540] dark:bg-[#1a2540] px-4 py-2.5 text-center sm:px-6">
            <p className="text-sm font-semibold text-white/90">
              {formatMatchDate(series.startDate)} — {formatMatchDate(series.endDate)}
            </p>
          </div>
        </div>

        {/* Series Highlights — aggregate stats grid (hidden until matches
            have been scored, so upcoming series don't show a wall of 0s) */}
        <SeriesHighlights matches={seriesMatches} />

        {/* Tabs — Standings / Matches / Top Performers */}
        <Tabs defaultValue={seriesMatches.some((m) => m.status === "completed") ? "standings" : "matches"} className="w-full">
          <TabsList className="flex w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
            {seriesMatches.some((m) => m.status === "completed") && (
              <TabsTrigger value="standings" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                <Trophy className="h-4 w-4" />
                Standings
              </TabsTrigger>
            )}
            <TabsTrigger value="matches" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
              <CalIcon className="h-4 w-4" />
              Matches
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
              <Users className="h-4 w-4" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="performers" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
              <BarChart3 className="h-4 w-4" />
              Top Performers
            </TabsTrigger>
          </TabsList>

          {seriesMatches.some((m) => m.status === "completed") && (
            <TabsContent value="standings" className="mt-4">
              <Standings matches={seriesMatches} />
            </TabsContent>
          )}

          <TabsContent value="matches" className="mt-4 space-y-2">
            {seriesMatches.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No matches scheduled yet.
              </Card>
            ) : (
              seriesMatches.map((m) => (
                <MiniScorecard key={m.id} match={m} />
              ))
            )}
          </TabsContent>

          <TabsContent value="teams" className="mt-4">
            {seriesTeams.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No teams in this series yet.
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {seriesTeams.map((t) => (
                  <a
                    key={t.id}
                    href={`/teams/${t.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <TeamBadge team={t} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.shortName}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="performers" className="mt-4">
            <TopPerformers matches={seriesMatches} />
          </TabsContent>
        </Tabs>
      </div>
    </InnerPageLayout>
  )
}

/* ---- Top Performers (auto-aggregated from match scorecards) ---- */

interface BatAgg {
  name: string
  playerId?: string
  runs: number
  balls: number
  fours: number
  sixes: number
  outs: number
}
interface BowlAgg {
  name: string
  playerId?: string
  wickets: number
  runs: number
  balls: number
}

function TopPerformers({ matches }: { matches: Match[] }) {
  const { topBatters, topBowlers } = useMemo(() => {
    const batMap = new Map<string, BatAgg>()
    const bowlMap = new Map<string, BowlAgg>()
    for (const m of matches) {
      if (m.status !== "completed") continue
      const sc = m.scorecard
      if (!sc?.innings) continue
      for (const inn of sc.innings) {
        for (const b of inn.batting) {
          if (b.name === "Extras" || b.name.toLowerCase().startsWith("total")) continue
          const existing = batMap.get(b.name) || { name: b.name, playerId: b.playerId, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0 }
          existing.runs += b.runs
          existing.balls += b.balls
          existing.fours += b.fours
          existing.sixes += b.sixes
          if (b.dismissal && !b.dismissal.includes("not out")) existing.outs++
          batMap.set(b.name, existing)
        }
        for (const b of inn.bowling ?? []) {
          const existing = bowlMap.get(b.name) || { name: b.name, playerId: b.playerId, wickets: 0, runs: 0, balls: 0 }
          existing.wickets += b.wickets
          existing.runs += b.runs
          existing.balls += Math.round(parseFloat(b.overs) * 6) || 0
          bowlMap.set(b.name, existing)
        }
      }
    }
    const topBatters = Array.from(batMap.values())
      .filter(b => b.runs > 0)
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 10)
    const topBowlers = Array.from(bowlMap.values())
      .filter(b => b.wickets > 0)
      .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
      .slice(0, 10)
    return { topBatters, topBowlers }
  }, [matches])

  if (topBatters.length === 0 && topBowlers.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {topBatters.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 bg-[#1e2a5e] px-4 py-2.5 text-white">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-wide">Most Runs</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <th className="py-2 pl-4 pr-2 text-left font-semibold">Batter</th>
                <th className="py-2 px-2 text-right font-semibold">R</th>
                <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">B</th>
                <th className="py-2 px-2 text-right font-semibold">4s</th>
                <th className="py-2 px-2 text-right font-semibold">6s</th>
                <th className="py-2 pl-2 pr-4 text-right font-semibold">Avg</th>
              </tr>
            </thead>
            <tbody>
              {topBatters.map((b, i) => (
                <tr key={i} className={`border-b border-border/40 ${i % 2 === 1 ? "bg-muted/15" : ""}`}>
                  <td className="py-2 pl-4 pr-2 font-medium">{b.name}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold">{b.runs}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{b.balls}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.fours}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.sixes}</td>
                  <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {b.outs > 0 ? (b.runs / b.outs).toFixed(1) : b.runs.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {topBowlers.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 bg-[#1e2a5e] px-4 py-2.5 text-white">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-wide">Most Wickets</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <th className="py-2 pl-4 pr-2 text-left font-semibold">Bowler</th>
                <th className="py-2 px-2 text-right font-semibold">W</th>
                <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">O</th>
                <th className="py-2 px-2 text-right font-semibold">R</th>
                <th className="py-2 pl-2 pr-4 text-right font-semibold">Econ</th>
              </tr>
            </thead>
            <tbody>
              {topBowlers.map((b, i) => (
                <tr key={i} className={`border-b border-border/40 ${i % 2 === 1 ? "bg-muted/15" : ""}`}>
                  <td className="py-2 pl-4 pr-2 font-medium">{b.name}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold">{b.wickets}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                    {(b.balls / 6).toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.runs}</td>
                  <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
