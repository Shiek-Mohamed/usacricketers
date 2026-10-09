"use client"

import { useMemo } from "react"
import { ArrowLeft, CalendarClock, Users } from "lucide-react"
import { useTeam, usePlayers, useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { TeamBadge, PlayerAvatar } from "@/components/cricket/ui"
import { MiniScorecard } from "@/components/cricket/mini-scorecard"
import { InnerPageLayout } from "@/components/site/inner-layout"
import {
  TeamInfoWidget,
  SquadSummaryWidget,
  RecentResultsWidget,
} from "@/components/site/sidebar-widgets"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Player } from "@/lib/types"

const ROLE_GROUPS: { label: string; match: (role: string) => boolean }[] = [
  {
    label: "Batsmen",
    match: (r) =>
      r.toLowerCase().includes("batsman") &&
      !r.toLowerCase().includes("wicket") &&
      !r.toLowerCase().includes("all"),
  },
  {
    label: "Bowlers",
    match: (r) =>
      r.toLowerCase().includes("bowler") &&
      !r.toLowerCase().includes("all"),
  },
  {
    label: "All-rounders",
    match: (r) => r.toLowerCase().includes("all"),
  },
  {
    label: "Wicket-keepers",
    match: (r) => r.toLowerCase().includes("wicket"),
  },
]

const SCROLLBAR_CLASS =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"

export function TeamDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data: team, loading: teamLoading } = useTeam(id)
  const { data: players, loading: playersLoading } = usePlayers(id ?? undefined)
  const { data: matches, loading: matchesLoading } = useMatches()

  const recentMatches = useMemo(() => {
    if (!matches || !id) return []
    return matches
      .filter((m) => m.team1Id === id || m.team2Id === id)
      .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
      .slice(0, 6)
  }, [matches, id])

  const grouped = useMemo(() => {
    const g: { [key: string]: Player[] } = {}
    for (const p of players ?? []) {
      const grp =
        ROLE_GROUPS.find((r) => r.match(p.role))?.label ?? "Batsmen"
      ;(g[grp] ||= []).push(p)
    }
    return g
  }, [players])

  if (teamLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!team) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Team not found.{" "}
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => navigate("teams")}
          >
            Back to teams
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
            onClick={() => navigate("teams")}
          >
            <ArrowLeft className="size-4" /> Back to Teams
          </Button>

          {/* Header card — full width above the sidebar */}
          <Card className="gap-0 overflow-hidden py-0">
            <div
              className="h-2 w-full"
              style={{ background: team.primaryColor }}
              aria-hidden
            />
            <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
              <TeamBadge team={team} size="xl" />
              <div className="min-w-0 flex-1 space-y-1">
                <h1 className="text-3xl font-extrabold tracking-tight">
                  {team.name}
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  {team.shortName} · {team.country}
                </p>
                {team.description && (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {team.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      }
      sidebar={
        <>
          <TeamInfoWidget team={team} />
          {players && players.length > 0 && (
            <SquadSummaryWidget players={players} />
          )}
          <RecentResultsWidget matches={recentMatches} title="Team Results" />
        </>
      }
    >
      <div className="space-y-5">
        {/* Squad — begins below the header card */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-emerald-600" />
              Squad
              <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                {players?.length ?? 0}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("p-0", SCROLLBAR_CLASS)}>
            <div className={cn("max-h-96 overflow-y-auto", SCROLLBAR_CLASS)}>
              {playersLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-md" />
                  ))}
                </div>
              ) : players && players.length > 0 ? (
                <ul className="divide-y">
                  {ROLE_GROUPS.map((grp) => {
                    const list = grouped[grp.label] ?? []
                    if (list.length === 0) return null
                    return (
                      <li key={grp.label}>
                        <div className="bg-muted/40 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          {grp.label} ({list.length})
                        </div>
                        {list.map((p) => (
                          <PlayerRow
                            key={p.id}
                            player={p}
                            onClick={() => navigate("player-detail", p.id)}
                          />
                        ))}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No players in this squad yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent matches */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="size-5 text-emerald-600" />
            Recent Matches
          </h2>
          {matchesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : recentMatches.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No recent matches for this team.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentMatches.map((m) => (
                <MiniScorecard key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>
      </div>
    </InnerPageLayout>
  )
}

function PlayerRow({
  player,
  onClick,
}: {
  player: Player
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent"
    >
      <PlayerAvatar name={player.name} team={player.team} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{player.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {player.battingStyle}
          {player.bowlingStyle ? ` · ${player.bowlingStyle}` : ""}
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        {player.role}
      </Badge>
    </button>
  )
}
