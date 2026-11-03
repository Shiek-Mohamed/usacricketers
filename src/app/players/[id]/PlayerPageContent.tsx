"use client"

import {
  BarChart3,
  Disc,
  Target,
  Activity,
  Users,
  Trophy,
  ChevronRight,
  Home as HomeIcon,
} from "lucide-react"
import { PlayerAvatar, TeamBadge } from "@/components/cricket/ui"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { TeammatesWidget } from "@/components/site/sidebar-widgets"
import { Header } from "@/components/site/header"
import { Footer } from "@/components/site/footer"
import { ShareButtons } from "@/components/site/share-buttons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BattingStat, BowlingStat, Player } from "@/lib/types"

/**
 * SSR player profile page.
 *
 * Lives at /players/[id] — the matching server component (`page.tsx` in
 * this directory) fetches the player + teammates from the DB at request
 * time and passes the serialized data in as props. NO client-side fetch
 * happens for the player itself — Google sees the full HTML in the
 * initial response.
 *
 * Differences from the SPA `PlayerDetailView`:
 *   • No `useAppStore` / `navigate()` — all links are real `<a href>`s so
 *     they trigger full page navigations (which is what we want for SEO).
 *   • No `usePlayer()` hook — player data arrives as props from the server.
 *   • No auto-stats fetch (`/api/players/[id]/stats`) — that endpoint can
 *     be linked to from the SPA view; the SSR page renders the canonical
 *     career stats from the player record.
 *   • Team / teammate links point to clean URLs `/teams/${id}` and
 *     `/players/${id}`.
 */

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

function PlayerBreadcrumbs({ name }: { name: string }) {
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
        href="/?view=players"
        className="transition-colors hover:text-foreground"
      >
        Players
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <span className="line-clamp-1 max-w-[60%] truncate font-medium text-foreground/80">
        {name}
      </span>
    </nav>
  )
}

export function PlayerPageContent({
  player,
  teammates,
}: {
  player: Player
  teammates: Player[]
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <InnerPageLayout
            header={
              <>
                <PlayerBreadcrumbs name={player.name} />

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
                      imageUrl={player.imageUrl}
                      size="xl"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-extrabold tracking-tight">
                          {player.name}
                        </h1>
                        {player.isCaptain && (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                            Captain
                          </Badge>
                        )}
                        {player.isKeeper && (
                          <Badge variant="secondary">Wicket-keeper</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {player.team && (
                          <a
                            href={`/teams/${player.team.id}`}
                            className="flex items-center gap-1.5 rounded-full px-1 py-0.5 transition-colors hover:bg-accent"
                          >
                            <TeamBadge team={player.team} size="sm" />
                            <span className="font-semibold text-foreground">
                              {player.team.name}
                            </span>
                          </a>
                        )}
                        <Badge variant="secondary">{player.role}</Badge>
                      </div>
                      {player.bio && (
                        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          {player.bio}
                        </p>
                      )}
                      <div className="pt-2">
                        <ShareButtons title={`${player.name} — Player Profile`} />
                      </div>
                    </div>

                    {/* Player Info grid — right side */}
                    <div className="w-full shrink-0 sm:w-80 lg:w-96">
                      <div className="overflow-hidden rounded-lg border border-border">
                        <div className="bg-gradient-to-r from-[#1e2a5e] to-[#2d3b7a] px-3 py-1.5">
                          <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <Activity className="size-3.5 text-amber-400" />
                            Player Info
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-border">
                          <div className="flex items-center gap-1.5 bg-card px-3 py-2">
                            <Target className="size-3.5 shrink-0 text-emerald-600" />
                            <div className="min-w-0">
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Batting
                              </div>
                              <div className="text-xs font-bold text-foreground">
                                {player.battingStyle}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 bg-card px-3 py-2">
                            <Disc className="size-3.5 shrink-0 text-amber-600" />
                            <div className="min-w-0">
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Bowling
                              </div>
                              <div className="text-xs font-bold text-foreground">
                                {player.bowlingStyle || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 bg-card px-3 py-2">
                            <Trophy className="size-3.5 shrink-0 text-purple-600" />
                            <div className="min-w-0">
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Role
                              </div>
                              <div className="text-xs font-bold text-foreground">
                                {player.role}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 bg-card px-3 py-2">
                            <Users className="size-3.5 shrink-0 text-blue-600" />
                            <div className="min-w-0">
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Team
                              </div>
                              <div className="text-xs font-bold text-foreground">
                                {player.team ? player.team.name : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            }
            sidebar={
              <>
                {teammates.length > 0 && (
                  <TeammatesWidget players={teammates} excludeId={player.id} />
                )}
                <CustomSidebarBlocks placement="player" />
              </>
            }
          >
            <div className="space-y-5">
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

              <p className="text-[11px] text-muted-foreground">
                All stats are career aggregates across formats as maintained by
                the CMS.
              </p>

              {/* Back to players */}
              <a
                href="/?view=players"
                className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
                All players
              </a>
            </div>
          </InnerPageLayout>
        </div>
      </main>
      <Footer />
    </div>
  )
}
