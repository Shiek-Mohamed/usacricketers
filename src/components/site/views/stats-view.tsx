"use client"

import { useMemo } from "react"
import { BarChart3, Trophy, TrendingUp } from "lucide-react"
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
import { usePlayers, useTeams, useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { PlayerAvatar, TeamBadge } from "@/components/cricket/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Player } from "@/lib/types"

// Format-specific ranking weight (mock per-format differentiation using
// the same aggregate stat). Display value is the raw runs / wickets.
const FORMAT_WEIGHT: { [key: string]: number } = {
  Test: 1.0,
  ODI: 0.85,
  T20I: 0.55,
  T10: 0.45,
}
const FORMATS = ["Test", "ODI", "T20I", "T10"] as const

export function StatsView() {
  const { data: players, loading: playersLoading } = usePlayers()
  const { data: teams, loading: teamsLoading } = useTeams()
  const { loading: matchesLoading } = useMatches()
  const loading = playersLoading || teamsLoading || matchesLoading

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-6 text-emerald-600" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Stats &amp; Records
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          ICC Rankings, all-time records and team performance — all in one place.
        </p>
      </header>

      <Tabs defaultValue="rankings" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="rankings" className="flex-1">Rankings</TabsTrigger>
          <TabsTrigger value="records" className="flex-1">Records</TabsTrigger>
          <TabsTrigger value="teams" className="flex-1">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="mt-4">
          <Rankings players={players} loading={loading} />
        </TabsContent>
        <TabsContent value="records" className="mt-4">
          <Records players={players} loading={loading} />
        </TabsContent>
        <TabsContent value="teams" className="mt-4">
          <TeamPerformance
            players={players}
            teams={teams}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

/* ----------------------------- Rankings ----------------------------- */

function Rankings({
  players,
  loading,
}: {
  players: Player[] | null
  loading: boolean
}) {
  if (loading || !players) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {FORMATS.map((fmt) => (
        <RankingsColumn key={fmt} format={fmt} players={players} />
      ))}
    </div>
  )
}

function RankingsColumn({
  format,
  players,
}: {
  format: string
  players: Player[]
}) {
  const w = FORMAT_WEIGHT[format] ?? 1
  const batters = useMemo(() => {
    return [...players]
      .filter((p) => p.battingStats.runs > 0)
      .sort(
        (a, b) =>
          b.battingStats.runs * w - a.battingStats.runs * w
      )
      .slice(0, 5)
  }, [players, w])

  const bowlers = useMemo(() => {
    return [...players]
      .filter((p) => p.bowlingStats && p.bowlingStats.wickets > 0)
      .sort(
        (a, b) =>
          (b.bowlingStats!.wickets * w - a.bowlingStats!.wickets * w)
      )
      .slice(0, 5)
  }, [players, w])

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b bg-muted/40 px-5 sm:px-6">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{format} Rankings</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            Top 5
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <RankList
          title="Batters"
          subtitle="Runs"
          players={batters}
          value={(p) => p.battingStats.runs}
        />
        <RankList
          title="Bowlers"
          subtitle="Wickets"
          players={bowlers}
          value={(p) => p.bowlingStats?.wickets ?? 0}
        />
      </CardContent>
    </Card>
  )
}

function RankList({
  title,
  subtitle,
  players,
  value,
}: {
  title: string
  subtitle: string
  players: Player[]
  value: (p: Player) => number
}) {
  if (players.length === 0) {
    return (
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground/70">No data</p>
      </div>
    )
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <span className="text-[10px] font-medium text-muted-foreground">
          {subtitle}
        </span>
      </div>
      <ol className="space-y-1">
        {players.map((p, i) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/60"
          >
            <span className="w-5 shrink-0 text-center text-sm font-extrabold text-emerald-700">
              {i + 1}
            </span>
            <PlayerAvatar
              name={p.name}
              team={p.team}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{p.name}</p>
              {p.team && (
                <div className="flex items-center gap-1">
                  <TeamBadge team={p.team} size="sm" className="!h-4 !w-4 !text-[7px]" />
                  <span className="text-[10px] text-muted-foreground">
                    {p.team.shortName}
                  </span>
                </div>
              )}
            </div>
            <span className="text-sm font-bold tabular-nums">
              {value(p)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ----------------------------- Records ----------------------------- */

interface Record {
  label: string
  holder: Player
  value: string
}

function Records({
  players,
  loading,
}: {
  players: Player[] | null
  loading: boolean
}) {
  const records = useMemo<Record[] | null>(() => {
    if (!players || players.length === 0) return null

    // Most Runs
    const mostRuns = [...players].reduce((a, b) =>
      b.battingStats.runs > a.battingStats.runs ? b : a
    )

    // Most Wickets
    const withBowl = players.filter((p) => p.bowlingStats && p.bowlingStats.wickets > 0)
    const mostWickets = withBowl.length
      ? withBowl.reduce((a, b) =>
          (b.bowlingStats!.wickets > a.bowlingStats!.wickets) ? b : a
        )
      : null

    // Highest Individual Score: parse numeric part of "highest"
    const highestScorer = [...players].reduce((a, b) => {
      const av = parseHigh(a.battingStats.highest)
      const bv = parseHigh(b.battingStats.highest)
      return bv > av ? b : a
    })

    // Best Bowling: parse "X/Y" — sort by wickets desc, then runs asc
    const bestBowler = withBowl.length
      ? withBowl.reduce((a, b) => {
          const [aw, ar] = parseBest(a.bowlingStats!.best)
          const [bw, br] = parseBest(b.bowlingStats!.best)
          if (bw !== aw) return bw > aw ? b : a
          return br < ar ? b : a
        })
      : null

    const list: Record[] = [
      { label: "Most Runs", holder: mostRuns, value: `${mostRuns.battingStats.runs}` },
    ]
    if (mostWickets)
      list.push({
        label: "Most Wickets",
        holder: mostWickets,
        value: `${mostWickets.bowlingStats!.wickets}`,
      })
    list.push({
      label: "Highest Individual Score",
      holder: highestScorer,
      value: highestScorer.battingStats.highest,
    })
    if (bestBowler)
      list.push({
        label: "Best Bowling",
        holder: bestBowler,
        value: bestBowler.bowlingStats!.best,
      })

    return list
  }, [players])

  if (loading || !records) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {records.map((r) => (
        <Card key={r.label} className="gap-0 overflow-hidden py-0">
          <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-red-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Trophy className="size-5" />
              <span className="text-xs font-bold uppercase tracking-wide">
                {r.label}
              </span>
            </div>
          </div>
          <CardContent className="space-y-1.5 p-4">
            <p className="text-lg font-extrabold tracking-tight">
              {r.holder.name}
            </p>
            <div className="flex items-center gap-1.5">
              {r.holder.team && (
                <TeamBadge team={r.holder.team} size="sm" />
              )}
              <span className="text-xs text-muted-foreground">
                {r.holder.team?.shortName ?? "—"}
              </span>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold text-emerald-700">
                {r.value}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function parseHigh(h: string): number {
  const m = h.match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

function parseBest(b: string): [number, number] {
  // Format "X/Y" or "X-Y"
  const m = b.match(/(\d+)\s*[/\-]\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  return [0, 0]
}

/* ------------------------- Team Performance ------------------------- */

const TEAM_COLORS = [
  "#059669",
  "#b91c1c",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#475569",
]

function TeamPerformance({
  players,
  teams,
  loading,
}: {
  players: Player[] | null
  teams: { id: string; shortName: string; name: string }[] | null
  loading: boolean
}) {
  const data = useMemo(() => {
    if (!players || !teams) return []
    const map = new Map<string, number>()
    for (const p of players) {
      map.set(p.teamId, (map.get(p.teamId) ?? 0) + p.battingStats.runs)
    }
    return teams
      .map((t, i) => ({
        name: t.shortName,
        fullName: t.name,
        runs: map.get(t.id) ?? 0,
        color: TEAM_COLORS[i % TEAM_COLORS.length],
      }))
      .sort((a, b) => b.runs - a.runs)
  }, [players, teams])

  if (loading || data.length === 0) {
    return <Skeleton className="h-80 w-full rounded-xl" />
  }

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-5 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-emerald-600" />
          Team Performance — Total Career Runs by Squad
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fontWeight: 600 }}
                className="text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                }}
                formatter={(v: number) => [`${v.toLocaleString()} runs`, "Runs"]}
              />
              <Bar dataKey="runs" radius={[4, 4, 0, 0]}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
