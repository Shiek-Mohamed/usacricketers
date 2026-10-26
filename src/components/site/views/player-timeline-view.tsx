"use client"

import { useAppStore } from "@/lib/store"
import { usePlayer, useMatches } from "@/lib/use-data"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayerAvatar, FormatPill, formatDate } from "@/components/cricket/ui"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Star, Calendar } from "lucide-react"
import type { Match, Player } from "@/lib/types"

export function PlayerTimelineView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data: player, loading } = usePlayer(id)
  const { data: allMatches } = useMatches()

  if (loading) {
    return (
      <InnerPageLayout title="Player Timeline" icon={TrendingUp}>
        <Skeleton className="h-64 w-full rounded-lg" />
      </InnerPageLayout>
    )
  }

  if (!player) {
    return (
      <InnerPageLayout title="Player Timeline" icon={TrendingUp}>
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          Player not found.
        </CardContent></Card>
      </InnerPageLayout>
    )
  }

  // Find matches where this player's team played.
  const playerMatches = (allMatches ?? [])
    .filter((m) => m.team1Id === player.teamId || m.team2Id === player.teamId)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

  const milestones = extractMilestones(player, playerMatches)

  return (
    <InnerPageLayout
      title={`${player.name} — Career Timeline`}
      icon={TrendingUp}
      header={
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h1 className="text-2xl font-extrabold">{player.name}</h1>
            <p className="text-sm text-muted-foreground">
              {player.role} · {player.team?.shortName ?? "?"}
              {player.isCaptain && " · Captain"}
              {player.isKeeper && " · Keeper"}
            </p>
          </div>
        </div>
      }
    >
      {/* Quick stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Matches" value={player.battingStats.matches} icon={Calendar} color="text-blue-600" />
        <StatCard label="Runs" value={player.battingStats.runs} icon={TrendingUp} color="text-emerald-600" />
        <StatCard label="100s" value={player.battingStats.hundreds} icon={Trophy} color="text-amber-600" />
        <StatCard label="50s" value={player.battingStats.fifties} icon={Star} color="text-purple-600" />
      </div>

      {/* Milestones timeline */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600" /> Career Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative pl-8">
              {/* Timeline line */}
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

              {milestones.map((m, i) => (
                <div key={i} className="relative py-4 pr-4">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[22px] top-5 grid h-4 w-4 place-items-center rounded-full border-2 border-card ${m.color}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${m.dotColor}`} />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.badgeVariant} className="text-[10px]">
                          {m.type}
                        </Badge>
                        {m.value && (
                          <span className="text-sm font-bold tabular-nums">{m.value}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                      <button
                        onClick={() => navigate("match-detail", m.matchId)}
                        className="mt-1 text-xs text-primary hover:underline"
                      >
                        View match →
                      </button>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent matches */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Recent Matches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <ul className="divide-y">
              {playerMatches.slice(0, 10).map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => navigate("match-detail", m.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
                  >
                    <FormatPill format={m.format} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {m.team1?.shortName} v {m.team2?.shortName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.venue || m.city || "—"} · {formatDate(m.startDate)}
                      </div>
                    </div>
                    {m.result && (
                      <span className="shrink-0 text-xs text-muted-foreground max-w-32 truncate">
                        {m.result}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </InnerPageLayout>
  )
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

type Milestone = {
  type: string
  value?: string
  description: string
  date: string
  matchId: string
  color: string
  dotColor: string
  badgeVariant: "default" | "secondary" | "destructive" | "outline"
}

function extractMilestones(player: Player, matches: Match[]): Milestone[] {
  // For a real implementation, we'd parse the scorecard JSON for each match
  // to find the player's actual scores + milestones. For now, generate
  // milestones from the career stats + match list (placeholder until
  // scorecard-by-player parsing is implemented).
  const milestones: Milestone[] = []

  // Batting milestones from career stats
  if (player.battingStats.hundreds > 0) {
    milestones.push({
      type: "Century",
      value: `${player.battingStats.hundreds}×`,
      description: `${player.battingStats.hundreds} hundred${player.battingStats.hundreds !== 1 ? "s" : ""} in career`,
      date: "Career",
      matchId: matches[0]?.id ?? "",
      color: "border-amber-300 bg-amber-50",
      dotColor: "bg-amber-500",
      badgeVariant: "default",
    })
  }
  if (player.battingStats.fifties > 0) {
    milestones.push({
      type: "Fifty",
      value: `${player.battingStats.fifties}×`,
      description: `${player.battingStats.fifties} fift${player.battingStats.fifties !== 1 ? "ies" : "y"} in career`,
      date: "Career",
      matchId: matches[0]?.id ?? "",
      color: "border-purple-300 bg-purple-50",
      dotColor: "bg-purple-500",
      badgeVariant: "secondary",
    })
  }
  if (player.battingStats.highest && parseFloat(player.battingStats.highest) > 0) {
    milestones.push({
      type: "Highest Score",
      value: player.battingStats.highest,
      description: `Career best innings`,
      date: "Career",
      matchId: matches[0]?.id ?? "",
      color: "border-emerald-300 bg-emerald-50",
      dotColor: "bg-emerald-500",
      badgeVariant: "outline",
    })
  }

  // Add recent match milestones (debut + last match)
  if (matches.length > 0) {
    const lastMatch = matches[0]
    milestones.push({
      type: "Last Match",
      description: `${lastMatch.team1?.shortName} v ${lastMatch.team2?.shortName} — ${lastMatch.format}`,
      date: formatDate(lastMatch.startDate),
      matchId: lastMatch.id,
      color: "border-blue-300 bg-blue-50",
      dotColor: "bg-blue-500",
      badgeVariant: "secondary",
    })
  }

  return milestones
}
