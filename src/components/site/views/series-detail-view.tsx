"use client"

import { useMemo } from "react"
import { ArrowLeft, CalendarDays, Trophy } from "lucide-react"
import { useSeriesItem, useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { StatusPill, formatMatchDate } from "@/components/cricket/ui"
import { MiniScorecard } from "@/components/cricket/mini-scorecard"
import { InnerPageLayout } from "@/components/site/inner-layout"
import {
  SeriesInfoWidget,
  SeriesMatchesWidget,
} from "@/components/site/sidebar-widgets"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

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
      header={
        <>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => navigate("series")}
          >
            <ArrowLeft className="size-4" /> Back to Series
          </Button>

          {/* Header card — full width above the sidebar */}
          <Card className="gap-0 overflow-hidden py-0">
            <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 px-5 py-5 text-white sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Trophy className="size-5 text-amber-300" />
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {series.name}
                </h1>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/30">
                  {series.format}
                </span>
                <StatusPill status={series.status} />
                <span className="text-white/80">·</span>
                <span className="font-medium text-white/90">{series.season}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-white/80">
                <CalendarDays className="size-3.5" />
                {formatMatchDate(series.startDate)} —{" "}
                {formatMatchDate(series.endDate)}
              </div>
            </div>
            <CardContent className="p-5 sm:p-6">
              {series.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {series.description}
                </p>
              )}
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Matches in series
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700">
                  {seriesMatches.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      }
      sidebar={
        <>
          <SeriesInfoWidget series={series} />
          {seriesMatches.length > 0 && (
            <SeriesMatchesWidget matches={seriesMatches} />
          )}
        </>
      }
    >
      <div className="space-y-5">
        {/* Matches list — begins below the header card */}
        <div>
          <h2 className="mb-3 text-lg font-bold">Matches</h2>
          {matchesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : seriesMatches.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No matches scheduled in this series yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {seriesMatches.map((m) => (
                <MiniScorecard key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>
      </div>
    </InnerPageLayout>
  )
}
