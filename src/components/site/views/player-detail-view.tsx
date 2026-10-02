"use client"

import { useMemo } from "react"
import {
  ArrowLeft,
  BarChart3,
  Disc,
  Target,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { usePlayer } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { PlayerAvatar, TeamBadge } from "@/components/cricket/ui"
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

  const battingChartData = useMemo(() => {
    if (!player) return []
    const bs = player.battingStats
    return [
      { name: "Runs", value: bs.runs, color: "#059669" },
      { name: "100s", value: bs.hundreds, color: "#d97706" },
      { name: "50s", value: bs.fifties, color: "#b91c1c" },
      { name: "4s", value: bs.fours, color: "#0891b2" },
      { name: "6s", value: bs.sixes, color: "#7c3aed" },
    ]
  }, [player])

  const bowlingChartData = useMemo(() => {
    if (!player?.bowlingStats) return []
    const bw = player.bowlingStats
    return [
      { name: "Wickets", value: bw.wickets, color: "#059669" },
      { name: "Maidens", value: bw.maidens, color: "#d97706" },
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
    <section className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => navigate("players")}
      >
        <ArrowLeft className="size-4" /> Back to Players
      </Button>

        {/* Header */}
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

        {/* Batting stats */}
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

        {/* Batting chart */}
        <Card className="gap-2 py-4">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle className="text-sm font-semibold">
              Batting Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={battingChartData}
                  margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {battingChartData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bowling stats (if any) */}
        {player.bowlingStats && (
          <>
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

            <Card className="gap-2 py-4">
              <CardHeader className="px-5 sm:px-6">
                <CardTitle className="text-sm font-semibold">
                  Bowling Highlights
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={bowlingChartData}
                      margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(0,0,0,0.04)" }}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {bowlingChartData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}

      <Separator />
      <p className="text-[11px] text-muted-foreground">
        All stats are career aggregates across formats as maintained by the CMS.
      </p>
    </section>
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
