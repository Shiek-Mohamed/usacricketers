"use client"

import { useMemo, useState } from "react"
import { useMatches } from "@/lib/use-data"
import type { Match } from "@/lib/types"
import { MiniScorecard } from "@/components/cricket/mini-scorecard"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarClock, Trophy, Radio } from "lucide-react"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { RecentResultsWidget } from "@/components/site/sidebar-widgets"

type TabKey = "live" | "upcoming" | "recent"

function MatchGrid({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return (
      <Card className="grid min-h-[200px] place-items-center p-6">
        <div className="text-center">
          <div className="mb-2 text-3xl">🏏</div>
          <p className="text-sm text-muted-foreground">No matches in this category.</p>
        </div>
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m) => (
        <MiniScorecard key={m.id} match={m} />
      ))}
    </div>
  )
}

function MatchGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-lg" />
      ))}
    </div>
  )
}

export function MatchesView() {
  const { data, loading } = useMatches()
  const [tab, setTab] = useState<TabKey>("live")

  const matches = data ?? []
  const live = useMemo(
    () => matches.filter((m) => m.status === "live"),
    [matches]
  )
  const upcoming = useMemo(
    () => matches.filter((m) => m.status === "upcoming"),
    [matches]
  )
  const recent = useMemo(
    () => matches.filter((m) => m.status === "completed"),
    [matches]
  )

  return (
    <InnerPageLayout
      header={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <Radio className="h-6 w-6 text-red-600" />
              Live Scores
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All matches across series and formats.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
              <span className="font-semibold text-foreground">
                {live.length} Live
              </span>
            </div>
            <span className="text-muted-foreground">
              {upcoming.length} Upcoming
            </span>
            <span className="text-muted-foreground">
              {recent.length} Recent
            </span>
          </div>
        </div>
      }
      sidebar={
        <>
          <RecentResultsWidget matches={matches} />
          <CustomSidebarBlocks placement="match" />
        </>
      }
    >
      <div className="space-y-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="live" className="gap-1.5">
              <Radio className="h-3.5 w-3.5" />
              Live ({live.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Upcoming ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Recent ({recent.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-4">
            {loading ? <MatchGridSkeleton /> : <MatchGrid matches={live} />}
          </TabsContent>
          <TabsContent value="upcoming" className="mt-4">
            {loading ? <MatchGridSkeleton /> : <MatchGrid matches={upcoming} />}
          </TabsContent>
          <TabsContent value="recent" className="mt-4">
            {loading ? <MatchGridSkeleton /> : <MatchGrid matches={recent} />}
          </TabsContent>
        </Tabs>
      </div>
    </InnerPageLayout>
  )
}
