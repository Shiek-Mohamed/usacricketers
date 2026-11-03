"use client"

import {
  CalendarClock,
  Users,
  ChevronRight,
  Home as HomeIcon,
  Trophy,
} from "lucide-react"
import { TeamBadge, PlayerAvatar } from "@/components/cricket/ui"
import {
  FormatPill,
  StatusPill,
  formatMatchDate,
} from "@/components/cricket/ui"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import {
  TeamInfoWidget,
  SquadSummaryWidget,
} from "@/components/site/sidebar-widgets"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { ShareButtons } from "@/components/site/share-buttons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Match, Player, Team } from "@/lib/types"

/**
 * SSR team profile page.
 *
 * Lives at /teams/[id] — the matching server component (`page.tsx` in this
 * directory) fetches the team + players + recent matches from the DB at
 * request time and passes the serialized data in as props. NO client-side
 * fetch happens for the team itself — Google sees the full HTML in the
 * initial response.
 *
 * Differences from the SPA `TeamDetailView`:
 *   • No `useAppStore` / `navigate()` — all links are real `<a href>`s so
 *     they trigger full page navigations (which is what we want for SEO).
 *   • No `useTeam()` / `usePlayers()` / `useMatches()` hooks — data arrives
 *     as props from the server.
 *   • Player + match links point to clean URLs `/players/${id}` and
 *     `/matches/${id}`.
 */

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
      r.toLowerCase().includes("bowler") && !r.toLowerCase().includes("all"),
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

function TeamBreadcrumbs({ name }: { name: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
    >
      <a
        href="/"
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <HomeIcon className="h-3 w-3" />
        Home
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <a
        href="/?view=teams"
        className="transition-colors hover:text-foreground"
      >
        Teams
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <span className="line-clamp-1 max-w-[60%] truncate font-medium text-foreground/80">
        {name}
      </span>
    </nav>
  )
}

/** A single player card rendered as an `<a>` — links to the SSR player page. */
function PlayerCard({ player }: { player: Player }) {
  const bs = player.battingStats
  return (
    <a
      href={`/players/${player.id}`}
      className="group flex flex-col gap-0 overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="flex items-center gap-3 p-4">
        <PlayerAvatar
          name={player.name}
          team={player.team}
          imageUrl={player.imageUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-bold leading-tight group-hover:text-emerald-600 transition-colors">
            {player.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {player.battingStyle}
            {player.bowlingStyle ? ` · ${player.bowlingStyle}` : ""}
          </p>
          <Badge variant="secondary" className="mt-1.5 text-[10px]">
            {player.role}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-[11px] tabular-nums text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{bs.matches}</span>{" "}
          M
        </span>
        <span>
          <span className="font-semibold text-foreground">{bs.runs}</span> R
        </span>
        <span>
          <span className="font-semibold text-foreground">
            {bs.average.toFixed(1)}
          </span>{" "}
          Avg
        </span>
      </div>
    </a>
  )
}

/** A compact match row linking to the SSR match page. */
function MatchRow({ match }: { match: Match }) {
  return (
    <a
      href={`/matches/${match.id}`}
      className="group flex w-full items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30"
    >
      <FormatPill format={match.format} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {match.team1?.shortName} v {match.team2?.shortName}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {match.result || formatMatchDate(match.startDate)}
        </p>
      </div>
      <StatusPill status={match.status} />
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}

export function TeamPageContent({
  team,
  players,
  recentMatches,
}: {
  team: Team
  players: Player[]
  recentMatches: Match[]
}) {
  const grouped: { label: string; list: Player[] }[] = ROLE_GROUPS.map(
    (g) => ({
      label: g.label,
      list: players.filter((p) => g.match(p.role)),
    }),
  ).filter((g) => g.list.length > 0)
  // Catch-all for any role that doesn't fit the groups above.
  const categorizedIds = new Set(
    grouped.flatMap((g) => g.list.map((p) => p.id)),
  )
  const others = players.filter((p) => !categorizedIds.has(p.id))
  if (others.length > 0) {
    grouped.push({ label: "Others", list: others })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <InnerPageLayout
            header={
              <>
                <TeamBreadcrumbs name={team.name} />

                {/* Header card */}
                <Card className="gap-0 overflow-hidden py-0">
                  <div
                    className="h-2 w-full"
                    style={{ background: team.primaryColor }}
                    aria-hidden
                  />
                  <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                    <TeamBadge team={team} size="xl" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-extrabold tracking-tight">
                          {team.name}
                        </h1>
                        <Badge variant="secondary">{team.shortName}</Badge>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {team.shortName} · {team.country || "International"}
                      </p>
                      {team.description && (
                        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          {team.description}
                        </p>
                      )}
                      <div className="pt-2">
                        <ShareButtons title={`${team.name} — Team Profile`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            }
            sidebar={
              <>
                <TeamInfoWidget team={team} />
                {players.length > 0 && (
                  <SquadSummaryWidget players={players} />
                )}
                <CustomSidebarBlocks placement="team" />
              </>
            }
          >
            <div className="space-y-5">
              {/* Squad */}
              <Card className="gap-0 py-0">
                <CardHeader className="border-b px-5 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-emerald-600" />
                    Squad
                    <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {players.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 sm:p-6">
                  {players.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No players in this squad yet.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {grouped.map((grp) => (
                        <div key={grp.label}>
                          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            {grp.label} ({grp.list.length})
                          </h3>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {grp.list.map((p) => (
                              <PlayerCard key={p.id} player={p} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent matches */}
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <CalendarClock className="size-5 text-emerald-600" />
                  Recent Matches
                </h2>
                {recentMatches.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No recent matches for this team.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {recentMatches.map((m) => (
                      <MatchRow key={m.id} match={m} />
                    ))}
                  </div>
                )}
              </div>

              {/* Back to teams */}
              <a
                href="/?view=teams"
                className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
                All teams
              </a>
            </div>
          </InnerPageLayout>
        </div>
      </main>
      <Footer />
    </div>
  )
}
