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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
  const teamColor = player.team?.primaryColor ?? "#1e2a5e"
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          <InnerPageLayout
            sidebar={
              <>
                {teammates.length > 0 && (
                  <TeammatesWidget players={teammates} excludeId={player.id} />
                )}
                <CustomSidebarBlocks placement="player" />
              </>
            }
          >
            <div className="space-y-4">
              <PlayerBreadcrumbs name={player.name} />

              {/* Dark navy hero — player profile card */}
              <div className="overflow-hidden rounded-xl dark:ring-1 dark:ring-white/10">
                {/* Top bar — team color + share */}
                <div className="flex items-center justify-between gap-2 bg-[#0f1729] dark:bg-[#0d1525] px-4 py-2 sm:px-6">
                  <div className="flex items-center gap-2">
                    {player.team && (
                      <a href={`/teams/${player.team.id}`} className="flex items-center gap-1.5">
                        <TeamBadge team={player.team} size="sm" />
                        <span className="text-sm font-bold text-white/90">{player.team.shortName}</span>
                      </a>
                    )}
                    <span className="text-xs text-white/50">{player.role}</span>
                  </div>
                  <ShareButtons title={`${player.name} — Player Profile`} />
                </div>

                {/* Hero body — dark gradient with photo + name */}
                <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] px-4 py-6 sm:px-6 sm:py-8">
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                    {/* Player photo / avatar */}
                    {player.imageUrl ? (
                      <img
                        src={player.imageUrl}
                        alt={player.name}
                        className="h-24 w-24 rounded-full object-cover ring-4 ring-white/20 sm:h-28 sm:w-28"
                      />
                    ) : (
                      <div
                        className="grid h-24 w-24 place-items-center rounded-full font-display text-2xl font-bold text-white ring-4 ring-white/20 sm:h-28 sm:w-28"
                        style={{ background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}bb 100%)` }}
                      >
                        {player.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Name + badges + bio */}
                    <div className="flex-1 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                          {player.name}
                        </h1>
                        {player.isCaptain && (
                          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">C</span>
                        )}
                        {player.isKeeper && (
                          <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">WK</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-sm text-white/70 sm:justify-start">
                        <span className="font-bold uppercase tracking-wide">{player.role}</span>
                        <span className="text-white/30">·</span>
                        <span>{player.battingStyle}</span>
                        {player.bowlingStyle && (
                          <>
                            <span className="text-white/30">·</span>
                            <span>{player.bowlingStyle}</span>
                          </>
                        )}
                      </div>
                      {player.bio && (
                        <p className="mt-2 max-w-xl text-sm text-white/50">{player.bio}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status strip — quick stats summary */}
                <div className="bg-[#162244] dark:bg-[#1a2540] px-4 py-2.5 text-center sm:px-6">
                  <p className="text-sm font-semibold text-white/90">
                    {player.battingStats?.matches ?? 0} matches · {player.battingStats?.runs ?? 0} runs · {player.battingStats?.wickets ?? player.bowlingStats?.wickets ?? 0} wickets
                  </p>
                </div>
              </div>

              {/* Tabbed layout — Batting / Bowling / Info */}
              <Tabs defaultValue="batting" className="w-full">
                <TabsList className="flex w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
                  <TabsTrigger value="batting" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    <BarChart3 className="h-4 w-4" />
                    Batting
                  </TabsTrigger>
                  {player.bowlingStats && (
                    <TabsTrigger value="bowling" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                      <Disc className="h-4 w-4" />
                      Bowling
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="info" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none">
                    <Activity className="h-4 w-4" />
                    Info
                  </TabsTrigger>
                </TabsList>

                {/* Batting tab */}
                <TabsContent value="batting" className="mt-4">
                  <Card className="overflow-hidden p-0">
                    <div className="border-b bg-muted/30 px-4 py-2.5">
                      <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
                        <BarChart3 className="h-4 w-4 text-emerald-600" /> Batting Statistics
                      </h3>
                    </div>
                    <BattingTable stats={player.battingStats} />
                  </Card>
                </TabsContent>

                {/* Bowling tab */}
                {player.bowlingStats && (
                  <TabsContent value="bowling" className="mt-4">
                    <Card className="overflow-hidden p-0">
                      <div className="border-b bg-muted/30 px-4 py-2.5">
                        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
                          <Disc className="h-4 w-4 text-amber-600" /> Bowling Statistics
                        </h3>
                      </div>
                      <BowlingTable stats={player.bowlingStats} />
                    </Card>
                  </TabsContent>
                )}

                {/* Info tab */}
                <TabsContent value="info" className="mt-4">
                  <Card className="overflow-hidden p-0">
                    <div className="border-b bg-muted/30 px-4 py-2.5">
                      <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
                        <Activity className="h-4 w-4 text-emerald-600" /> Player Info
                      </h3>
                    </div>
                    <div className="divide-y divide-border/40">
                      <InfoRow label="Full Name" value={player.name} />
                      <InfoRow label="Role" value={player.role} />
                      <InfoRow label="Batting Style" value={player.battingStyle} />
                      <InfoRow label="Bowling Style" value={player.bowlingStyle || "—"} />
                      <InfoRow label="Team" value={player.team?.name ?? "—"} />
                      {player.isCaptain && <InfoRow label="Captain" value="Yes" />}
                      {player.isKeeper && <InfoRow label="Wicket-keeper" value="Yes" />}
                      {player.bio && <InfoRow label="Bio" value={player.bio} />}
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>

              <p className="text-xs text-muted-foreground">
                All stats are career aggregates across formats as maintained by the CMS.
              </p>

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="w-32 shrink-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
