"use client"

import { useMemo, useEffect, useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  Disc,
  Target,
  Activity,
} from "lucide-react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { usePlayer, usePlayers } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { PlayerAvatar, TeamBadge } from "@/components/cricket/ui"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import {
  PlayerSummaryWidget,
  PlayerInfoWidget,
  TeammatesWidget,
} from "@/components/site/sidebar-widgets"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BattingStat, BowlingStat } from "@/lib/types"

export function PlayerDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data: player, loading } = usePlayer(id)
  const { data: teammates } = usePlayers(player?.teamId)

  // Auto-computed career stats from match scorecards
  const [autoStats, setAutoStats] = useState<{
    batting?: Record<string, number | string>
    bowling?: Record<string, number | string>
    matchesScored: number
    recentInnings?: {
      runs: number
      balls: number
      fours: number
      sixes: number
      strikeRate: number
      dismissal: string
      opponent: string
      matchNo: string
      format: string
      date: string
    }[]
  } | null>(null)
  useEffect(() => {
    if (!player?.id) return
    fetch(`/api/players/${player.id}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAutoStats(d))
      .catch(() => {})
  }, [player?.id])

  // Normalized radar data for the batting profile chart. Each stat is
  // scaled to 0-100 based on a "top player" benchmark, so the radar shows
  // the player's shape (power hitter vs accumulator vs all-rounder).
  const battingRadarData = useMemo(() => {
    if (!player) return []
    const bs = player.battingStats
    return [
      { stat: "Avg", value: Math.min(100, (bs.average / 55) * 100) },
      { stat: "SR", value: Math.min(100, (bs.strikeRate / 140) * 100) },
      { stat: "100s", value: Math.min(100, (bs.hundreds / 50) * 100) },
      { stat: "50s", value: Math.min(100, (bs.fifties / 100) * 100) },
      { stat: "4s", value: Math.min(100, (bs.fours / 2000) * 100) },
      { stat: "6s", value: Math.min(100, (bs.sixes / 500) * 100) },
    ]
  }, [player])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  if (!player) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Player not found.{" "}
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => navigate("players")}
          >
            Back to players
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
            onClick={() => navigate("players")}
          >
            <ArrowLeft className="size-4" /> Back to Players
          </Button>

          {/* Header card */}
          <Card className="gap-0 overflow-hidden py-0">
            <div
              className="h-2 w-full"
              style={{
                background: player.team
                  ? player.team.primaryColor
                  : "#475569",
              }}
              aria-hidden
            />
            <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
              <PlayerAvatar
                name={player.name}
                team={player.team}
                size="xl"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <h1 className="text-3xl font-extrabold tracking-tight">
                  {player.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {player.team && (
                    <button
                      className="flex items-center gap-1.5 rounded-full px-1 py-0.5 transition-colors hover:bg-accent"
                      onClick={() =>
                        player.team && navigate("team-detail", player.team.id)
                      }
                    >
                      <TeamBadge team={player.team} size="sm" />
                      <span className="font-semibold text-foreground">
                        {player.team.name}
                      </span>
                    </button>
                  )}
                  <Badge variant="secondary">{player.role}</Badge>
                </div>
                {player.bio && (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {player.bio}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Style chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 font-medium">
              <Target className="size-3.5 text-emerald-600" />
              {player.battingStyle}
            </span>
            {player.bowlingStyle && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 font-medium">
                <Disc className="size-3.5 text-amber-600" />
                {player.bowlingStyle}
              </span>
            )}
          </div>
        </>
      }
      sidebar={
        <>
          {teammates && teammates.length > 1 && (
            <TeammatesWidget players={teammates} excludeId={id ?? undefined} />
          )}
          <CustomSidebarBlocks placement="player" />
        </>
      }
    >
      <div className="space-y-5">
        {/* Player info — moved from sidebar to above the stats */}
        <PlayerSummaryWidget player={player} />
        <PlayerInfoWidget player={player} />

        {/* Batting Statistics */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-emerald-600" />
              Batting Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <BattingTable stats={player.battingStats} />
          </CardContent>
        </Card>

        {/* Bowling Statistics (if any) */}
        {player.bowlingStats && (
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <Disc className="size-4 text-amber-600" />
                Bowling Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <BowlingTable stats={player.bowlingStats} />
            </CardContent>
          </Card>
        )}

      <Separator />

      {/* Auto-computed stats from scorecards */}
      {autoStats && autoStats.matchesScored > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
            <span className="h-5 w-1 rounded-full bg-emerald-600" />
            Career Stats (from scorecards)
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Auto-computed from {autoStats.matchesScored} match scorecard
            {autoStats.matchesScored !== 1 ? "s" : ""}. These update
            automatically as new matches are scored.
          </p>
          {autoStats.batting && (autoStats.batting.innings as number) > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-5 py-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="size-3.5 text-emerald-600" /> Auto Batting
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(autoStats.batting).map(([key, val]) => (
                      <tr key={key} className="border-b border-border/40">
                        <td className="py-1.5 pl-5 pr-2 text-muted-foreground capitalize">{key}</td>
                        <td className="py-1.5 pr-5 text-right font-semibold tabular-nums">
                          {String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          {autoStats.bowling && (autoStats.bowling.wickets as number) > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-5 py-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Disc className="size-3.5 text-amber-600" /> Auto Bowling
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(autoStats.bowling).map(([key, val]) => (
                      <tr key={key} className="border-b border-border/40">
                        <td className="py-1.5 pl-5 pr-2 text-muted-foreground capitalize">{key}</td>
                        <td className="py-1.5 pr-5 text-right font-semibold tabular-nums">
                          {String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent innings from scorecards */}
      {autoStats?.recentInnings && autoStats.recentInnings.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-3.5 text-emerald-600" />
              Recent Innings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                    <th className="py-2 pl-5 pr-2 text-left font-semibold">Opponent</th>
                    <th className="py-2 px-2 text-left font-semibold hidden sm:table-cell">Match</th>
                    <th className="py-2 px-2 text-right font-semibold">R</th>
                    <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">B</th>
                    <th className="py-2 px-2 text-right font-semibold">4s</th>
                    <th className="py-2 px-2 text-right font-semibold">6s</th>
                    <th className="py-2 px-2 text-right font-semibold">SR</th>
                    <th className="py-2 pl-2 pr-5 text-left font-semibold hidden md:table-cell">Dismissal</th>
                  </tr>
                </thead>
                <tbody>
                  {autoStats.recentInnings.map((inn, i) => (
                    <tr key={i} className={`border-b border-border/40 ${i % 2 === 1 ? "bg-muted/15" : ""}`}>
                      <td className="py-2 pl-5 pr-2 font-medium">vs {inn.opponent}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground hidden sm:table-cell">{inn.matchNo}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-bold">{inn.runs}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{inn.balls}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{inn.fours}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{inn.sixes}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{inn.strikeRate.toFixed(1)}</td>
                      <td className="py-2 pl-2 pr-5 text-xs text-muted-foreground hidden md:table-cell">{inn.dismissal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />
      <p className="text-[11px] text-muted-foreground">
        All stats are career aggregates across formats as maintained by the CMS.
      </p>
      </div>
    </InnerPageLayout>
  )
}

const BATTING_ROWS: { key: keyof BattingStat; label: string }[] = [
  { key: "matches", label: "Matches" },
  { key: "innings", label: "Innings" },
  { key: "notOuts", label: "Not Outs" },
  { key: "runs", label: "Runs" },
  { key: "highest", label: "Highest" },
  { key: "average", label: "Average" },
  { key: "strikeRate", label: "Strike Rate" },
  { key: "hundreds", label: "100s" },
  { key: "fifties", label: "50s" },
  { key: "fours", label: "4s" },
  { key: "sixes", label: "6s" },
]

function BattingTable({ stats }: { stats: BattingStat }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {BATTING_ROWS.map((r) => (
            <TableHead key={r.key} className="text-[11px] uppercase">
              {r.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          {BATTING_ROWS.map((r) => {
            const v = stats[r.key]
            return (
              <TableCell key={r.key} className="font-semibold tabular-nums">
                {typeof v === "number"
                  ? r.key === "average" || r.key === "strikeRate"
                    ? v.toFixed(2)
                    : v
                  : v}
              </TableCell>
            )
          })}
        </TableRow>
      </TableBody>
    </Table>
  )
}

const BOWLING_ROWS: { key: keyof BowlingStat; label: string }[] = [
  { key: "matches", label: "Matches" },
  { key: "innings", label: "Innings" },
  { key: "balls", label: "Balls" },
  { key: "runs", label: "Runs" },
  { key: "wickets", label: "Wickets" },
  { key: "best", label: "Best" },
  { key: "economy", label: "Economy" },
  { key: "average", label: "Average" },
  { key: "strikeRate", label: "Strike Rate" },
  { key: "maidens", label: "Maidens" },
]

function BowlingTable({ stats }: { stats: BowlingStat }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {BOWLING_ROWS.map((r) => (
            <TableHead key={r.key} className="text-[11px] uppercase">
              {r.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          {BOWLING_ROWS.map((r) => {
            const v = stats[r.key]
            return (
              <TableCell key={r.key} className="font-semibold tabular-nums">
                {typeof v === "number"
                  ? r.key === "economy" ||
                    r.key === "average" ||
                    r.key === "strikeRate"
                    ? v.toFixed(2)
                    : v
                  : v}
              </TableCell>
            )
          })}
        </TableRow>
      </TableBody>
    </Table>
  )
}

/* --------------------------- Stat tile card --------------------------- */
function StatTile({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: "emerald" | "amber" | "cyan" | "purple"
}) {
  const colorMap = {
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
    amber: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    cyan: "border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/40",
    purple: "border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/40",
  }
  const textMap = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    cyan: "text-cyan-700 dark:text-cyan-300",
    purple: "text-purple-700 dark:text-purple-300",
  }
  return (
    <div className={`rounded-lg border p-2.5 text-center ${colorMap[color]}`}>
      <div className={`text-lg font-extrabold tabular-nums ${textMap[color]}`}>
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  )
}
