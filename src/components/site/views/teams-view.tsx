"use client"

import { useMemo, useState } from "react"
import { Search, Users } from "lucide-react"
import { useTeams } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { TeamBadge } from "@/components/cricket/ui"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Team } from "@/lib/types"

export function TeamsView() {
  const { data: teams, loading } = useTeams()
  const navigate = useAppStore((s) => s.navigate)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (!teams) return []
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.country.toLowerCase().includes(q)
    )
  }, [teams, query])

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-emerald-600" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Teams
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          International cricket teams across all formats.
        </p>
      </header>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, short name or country…"
          className="pl-9"
          aria-label="Search teams"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No teams match “{query}”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((t) => (
            <TeamCard key={t.id} team={t} onClick={() => navigate("team-detail", t.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function TeamCard({
  team,
  onClick,
}: {
  team: Team
  onClick: () => void
}) {
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
      {/* Color strip */}
      <div
        className="h-2 w-full"
        style={{ background: team.primaryColor }}
        aria-hidden
      />
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        <TeamBadge team={team} size="xl" />
        <p className="line-clamp-1 text-sm font-bold leading-tight">{team.name}</p>
        <p className="text-xs text-muted-foreground">
          {team.shortName} · {team.country}
        </p>
      </CardContent>
    </Card>
  )
}
