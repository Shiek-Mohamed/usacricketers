"use client"

import { useMemo, useState } from "react"
import { Search, Trophy, Users } from "lucide-react"
import { useMatches, useTeams } from "@/lib/use-data"
import { TeamBadge } from "@/components/cricket/ui"
import { CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Team } from "@/lib/types"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { RecentResultsWidget } from "@/components/site/sidebar-widgets"

export function TeamsView() {
  const { data: teams, loading } = useTeams()
  const { data: matchesData } = useMatches()
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
    <InnerPageLayout
      header={
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
      }
      sidebar={
        <>
          <RecentResultsWidget matches={matchesData ?? []} />
          <CustomSidebarBlocks placement="team" />
        </>
      }
    >
      <div className="space-y-5">
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
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {query ? `No teams match “${query}”.` : "No teams found."}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {query
                ? "Try a different name, short name or country."
                : "Check back soon for international cricket teams."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((t) => (
              <TeamCard key={t.id} team={t} href={`/teams/${t.id}`} />
            ))}
          </div>
        )}
      </div>
    </InnerPageLayout>
  )
}

function TeamCard({
  team,
  href,
}: {
  team: Team
  href: string
}) {
  return (
    <a
      href={href}
      className="group flex flex-col gap-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      {/* Color strip */}
      <div
        className="h-2 w-full"
        style={{ background: team.primaryColor }}
        aria-hidden
      />
      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
        <TeamBadge team={team} size="xl" />
        <p className="line-clamp-1 text-sm font-bold leading-tight group-hover:text-emerald-600 transition-colors">
          {team.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {team.shortName} · {team.country}
        </p>
      </CardContent>
    </a>
  )
}
