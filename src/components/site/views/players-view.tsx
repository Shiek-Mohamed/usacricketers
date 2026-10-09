"use client"

import { useMemo, useState } from "react"
import { Search, Users2 } from "lucide-react"
import { usePlayers, useTeams } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { PlayerAvatar, TeamBadge } from "@/components/cricket/ui"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Player } from "@/lib/types"

const ALL_TEAMS = "__all__"

export function PlayersView() {
  const navigate = useAppStore((s) => s.navigate)
  const { data: teams, loading: teamsLoading } = useTeams()
  const [teamId, setTeamId] = useState<string>(ALL_TEAMS)
  const { data: players, loading: playersLoading } = usePlayers(
    teamId === ALL_TEAMS ? undefined : teamId
  )
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (!players) return []
    const q = query.trim().toLowerCase()
    if (!q) return players
    return players.filter((p) => p.name.toLowerCase().includes(q))
  }, [players, query])

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Users2 className="size-6 text-emerald-600" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Players
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Search international cricketers and view career stats at a glance.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={teamId}
          onValueChange={(v) => setTeamId(v)}
          disabled={teamsLoading}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by team">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TEAMS}>All Teams</SelectItem>
            {teams?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.shortName} · {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by player name…"
            className="pl-9"
            aria-label="Search players"
          />
        </div>
      </div>

      {/* Grid */}
      {playersLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No players found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              onClick={() => navigate("player-detail", p.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PlayerCard({
  player,
  onClick,
}: {
  player: Player
  onClick: () => void
}) {
  const bs = player.battingStats
  const bw = player.bowlingStats
  const isBowler = bw !== null

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className="group cursor-pointer gap-0 overflow-hidden p-0 py-0 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="flex items-center gap-3 p-4">
        <PlayerAvatar
          name={player.name}
          team={player.team}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-bold leading-tight">{player.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {player.team && <TeamBadge team={player.team} size="sm" />}
            <span className="truncate text-xs text-muted-foreground">
              {player.team?.shortName ?? "—"}
            </span>
          </div>
          <Badge variant="secondary" className="mt-1.5 text-[10px]">
            {player.role}
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-2 border-t px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          {player.battingStyle}
          {player.bowlingStyle ? ` · ${player.bowlingStyle}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums">
          <Stat label="M" value={bs.matches} />
          <Stat label="R" value={bs.runs} />
          <Stat label="Avg" value={bs.average.toFixed(1)} />
          <Stat label="100s" value={bs.hundreds} />
          <Stat label="50s" value={bs.fifties} />
          {isBowler && bw && <Stat label="W" value={bw.wickets} />}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span>{" "}
      <span className="text-[10px] uppercase">{label}</span>
    </span>
  )
}
