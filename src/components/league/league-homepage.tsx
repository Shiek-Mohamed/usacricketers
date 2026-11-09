"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  LeagueHomepageData,
  CentreMatch,
  PlayerStat,
  LeagueArticle,
} from "@/lib/league-data"

/* ------------------------------------------------------------------ */
/* Small reusable presentational helpers                                */
/* ------------------------------------------------------------------ */

function Crest({ initials }: { initials: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid h-12 w-[43px] place-items-center",
        "bg-gradient-to-br from-[#f3c85f] to-[#dca536]",
        "text-navy font-black text-[19px]",
        "[clip-path:polygon(50%_0,95%_15%,88%_72%,50%_100%,12%_72%,5%_15%)]",
      )}
    >
      {initials}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-[3px] bg-cricket-red px-[9px] py-[5px] text-[10px] font-extrabold uppercase tracking-[1px] text-navy">
      {children}
    </span>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-extrabold uppercase tracking-[1.6px] text-cricket-red">
      {children}
    </div>
  )
}

/** Maps a nav label to the main site URL (so league page links go to the right view). */
function navHref(label: string): string {
  const map: Record<string, string> = {
    Home: "/",
    News: "/?view=news",
    Players: "/?view=players",
    Matches: "/?view=matches",
    Teams: "/?view=teams",
    Statistics: "/?view=stats",
    Series: "/?view=series",
    League: "/",
    "Latest News": "/?view=news",
  }
  return map[label] || "/"
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  viewLabel,
  viewHref,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  viewLabel?: string
  viewHref?: string
}) {
  return (
    <div className="mb-[17px] flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-0.5 text-[19px] text-navy">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-league-muted">{subtitle}</p>
        ) : null}
      </div>
      {viewLabel ? (
        <a
          href={viewHref || "/"}
          className="text-xs font-extrabold text-cricket-red whitespace-nowrap"
        >
          {viewLabel}
        </a>
      ) : null}
    </div>
  )
}

function StatusBadge({ status, label }: { status: "live" | "final" | "upcoming"; label: string }) {
  const color =
    status === "live"
      ? "text-cricket-red"
      : status === "final"
        ? "text-league-green"
        : "text-league-muted"
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 bg-transparent px-0 text-[10px] font-black uppercase tracking-[.7px] p-0",
        color,
      )}
    >
      {label}
    </Badge>
  )
}

/** Empty-state card used inside the Match Centre tabs and elsewhere. */
function EmptyStateCard({ message }: { message: string }) {
  return (
    <Card className="col-span-full gap-0 rounded-lg border-league-line bg-white p-6 text-center shadow-none">
      <p className="text-xs text-league-muted">{message}</p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export function LeagueHomepage({ data }: { data: LeagueHomepageData }) {
  const {
    league,
    recentResults,
    liveMatches,
    upcomingMatches,
    standings,
    topBatsmen,
    topBowlers,
    topFielders,
    articles,
    gallery,
  } = data

  const leagueName = league.name || "LEAGUE"
  const leagueShortName = league.shortName || "CRICKET"
  const leagueInitials = league.initials || "LG"
  const season = league.season || new Date().getFullYear().toString()

  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  // Match Centre tab state.
  const resultsTabData: CentreMatch[] = React.useMemo<CentreMatch[]>(
    () =>
      recentResults.map((r): CentreMatch => ({
        division: r.division,
        date: r.date,
        status: "final",
        statusLabel: "FINAL",
        teams: r.teams,
        foot: r.result,
      })),
    [recentResults],
  )

  // Player of the week — fall back to top batsman #1 if we have one,
  // otherwise the section is hidden.
  const playerOfWeek = topBatsmen[0] ?? null

  return (
    <div className="min-w-0 bg-league-bg text-league-ink font-sans">
      {/* ------------------------------------------------------------ */}
      {/* WISDEN-STYLE DARK HERO BANNER                                  */}
      {/* ------------------------------------------------------------ */}
      <div className="mx-auto w-full max-w-[1200px] px-3 pt-4 sm:px-5">
        <div className="overflow-hidden rounded-xl dark:ring-1 dark:ring-white/10">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-2 bg-[#0f1729] dark:bg-[#0d1525] px-4 py-2 sm:px-6">
            <span className="text-xs font-bold uppercase tracking-wide text-white/50">{league.format || "Cricket"} · {season}</span>
            <a href="/" className="text-xs font-bold text-white/40 hover:text-white/70">← Back to site</a>
          </div>

          {/* Hero body — dark gradient with league name */}
          <div className="bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] px-4 py-6 sm:px-6 sm:py-8">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-4 sm:text-left">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 ring-4 ring-white/20">
                <span className="font-display text-xl font-bold text-white">{leagueInitials}</span>
              </div>
              <div className="flex-1">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{leagueName}</h1>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-white/70 sm:justify-start">
                  <span className="font-bold uppercase tracking-wide">{leagueShortName}</span>
                  <span className="text-white/30">·</span>
                  <span>{season}</span>
                  <span className="text-white/30">·</span>
                  <span>{recentResults.length + upcomingMatches.length + liveMatches.length} matches</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status strip */}
          <div className="bg-[#162244] dark:bg-[#1a2540] px-4 py-2.5 text-center sm:px-6">
            <p className="text-sm font-semibold text-white/90">
              {liveMatches.length > 0 && <span className="text-red-400">{liveMatches.length} live · </span>}
              {recentResults.length} completed · {upcomingMatches.length} upcoming
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 1: TOPLINE BAR                                         */}
      {/* ------------------------------------------------------------ */}
      <div className="bg-navy-dark text-[#b8c5d4] text-xs py-2">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>OFFICIAL LEAGUE HUB • Season {season}</div>
            <div className="hidden sm:flex items-center gap-4">
              <a href="#" className="hover:text-white">About</a>
              <a href="#" className="hover:text-white">Contact</a>
              <a href="#" className="hover:text-white">Follow Us</a>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 2: HEADER / NAV                                        */}
      {/* ------------------------------------------------------------ */}
      <header className="sticky top-0 z-20 bg-navy text-white shadow-[0_4px_18px_#08281822]">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <div className="flex h-[66px] items-center gap-7 md:h-[76px]">
            {/* Brand */}
            <a
              href="/"
              className="flex min-w-0 items-center gap-[11px] md:min-w-[220px]"
            >
              <Crest initials={leagueInitials} />
              <div className="leading-[1.2]">
                <strong className="block text-sm font-bold tracking-[0.7px]">
                  {leagueName}
                </strong>
                <small className="mt-1 block text-[10px] tracking-[1.7px] text-[#b8c8d9]">
                  {leagueShortName}
                </small>
              </div>
            </a>

            {/* Desktop nav */}
            <nav className="hidden flex-1 items-center gap-[21px] lg:flex">
              {["Home", "News", "Players", "Matches", "Teams", "Statistics", "Series", "League"].map(
                (label, i) => (
                  <a
                    key={label}
                    href={navHref(label)}
                    className={cn(
                      "whitespace-nowrap text-[13px] font-semibold text-[#e4ebf3]",
                      i === 0 ? "text-[#ffd46d]" : "hover:text-[#ffd46d]",
                    )}
                  >
                    {label}
                  </a>
                ),
              )}
            </nav>

            {/* Mobile nav (collapsible) */}
            {mobileNavOpen ? (
              <nav
                className="absolute left-0 right-0 top-[66px] z-30 flex flex-col items-start gap-4 bg-navy px-5 pb-5 pt-[18px] lg:hidden"
                onClick={() => setMobileNavOpen(false)}
              >
                {["Home", "News", "Players", "Matches", "Teams", "Statistics", "Series", "League"].map(
                  (label) => (
                    <a
                      key={label}
                      href={navHref(label)}
                      className="text-sm font-semibold text-[#e4ebf3]"
                    >
                      {label}
                    </a>
                  ),
                )}
              </nav>
            ) : null}

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2.5">
              <a
                href="/?view=league-admin-login"
                className="hidden text-[13px] text-[#e5edf6] sm:inline"
              >
                Log In
              </a>
              <Button
                asChild
                className="bg-cricket-red text-navy hover:bg-cricket-red/90 rounded-[5px] px-4 py-2.5 text-[13px] font-semibold"
              >
                <a href="/?view=league-admin-signup">Register</a>
              </Button>
              <button
                type="button"
                aria-label="Toggle menu"
                onClick={() => setMobileNavOpen((v) => !v)}
                className="ml-1 text-2xl text-white lg:hidden"
              >
                ☰
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 3: RECENT MATCH RESULTS TICKER                         */}
      {/* ------------------------------------------------------------ */}
      <section className="border-b border-league-line bg-white py-[17px]">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <div className="mb-[11px] flex items-center justify-between">
            <div>
              <Eyebrow>The latest from the league</Eyebrow>
              <h2 className="mt-0.5 text-[19px] text-navy">Recent Match Results</h2>
            </div>
            <div className="hidden gap-[7px] sm:flex">
              <button
                type="button"
                aria-label="Previous"
                className="grid h-[31px] w-[31px] place-items-center rounded-full border border-league-line bg-white text-navy"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next"
                className="grid h-[31px] w-[31px] place-items-center rounded-full border border-league-line bg-white text-navy"
              >
                ›
              </button>
            </div>
          </div>

          {recentResults.length === 0 ? (
            <Card className="gap-0 rounded-lg border-league-line bg-white px-3.5 py-3 text-center shadow-none">
              <p className="text-[11px] text-league-muted">No results yet</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {recentResults.map((r, i) => (
                <Card
                  key={`${r.division}-${r.date}-${i}`}
                  className="gap-0 rounded-lg border-league-line bg-white px-3.5 py-3 shadow-none"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.7px] text-league-muted">
                    <span>
                      {r.division} · {r.date}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-0 bg-transparent p-0 text-[10px] font-bold uppercase tracking-[0.7px] text-league-green"
                    >
                      FINAL
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-[5px] text-[13px] font-bold">
                    <span className="truncate">{r.teams[0].name}</span>
                    <strong className="font-bold tabular-nums">{r.teams[0].score}</strong>
                    <span className="truncate">{r.teams[1].name}</span>
                    <strong className="font-bold tabular-nums">{r.teams[1].score}</strong>
                  </div>
                  <div className="mt-[7px] text-[11px] text-league-muted">{r.result}</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 4: HERO / NEWS                                         */}
      {/* ------------------------------------------------------------ */}
      <section id="news" className="mx-auto w-full max-w-[1200px] px-3 pt-[27px] pb-6 sm:px-5">
        {articles.length === 0 ? (
          /* No articles — render a default hero card. */
          <div className="grid grid-cols-1 gap-[17px] md:grid-cols-[1.75fr_1fr]">
            <article
              className="relative flex h-[360px] flex-col justify-end overflow-hidden rounded-[10px] bg-navy p-8 text-white md:h-[390px]"
            >
              <Tag>Welcome · {league.format}</Tag>
              <h1 className="my-3.5 text-[clamp(27px,3.3vw,43px)] font-bold leading-[1.08] tracking-[-1px]">
                Welcome to {leagueName}
              </h1>
              <p className="mb-[17px] max-w-[500px] text-sm text-[#dce6ef]">
                {league.description
                  ? league.description
                  : `The official hub for ${leagueName} — fixtures, results, standings and player statistics for the ${season} season.`}
              </p>
            </article>
            <div className="grid grid-cols-2 gap-[17px] md:grid-cols-1 md:grid-rows-2">
              <article className="relative flex h-[150px] flex-col justify-end overflow-hidden rounded-[9px] bg-[#1a6b3f] p-4 text-white md:h-auto md:min-h-0">
                <Tag>Coming Up</Tag>
                <h3 className="mt-2 text-[17px] font-bold leading-[1.2]">
                  Fixtures will appear here as the season gets underway.
                </h3>
              </article>
              <article className="relative flex h-[150px] flex-col justify-end overflow-hidden rounded-[9px] bg-[#1a6b3f] p-4 text-white md:h-auto md:min-h-0">
                <Tag>Stay Tuned</Tag>
                <h3 className="mt-2 text-[17px] font-bold leading-[1.2]">
                  Match reports and league news coming soon.
                </h3>
              </article>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[17px] md:grid-cols-[1.75fr_1fr]">
            {/* Main hero — first article */}
            <HeroArticle article={articles[0]} season={season} />

            {/* Side stories — next two articles (or placeholder cards) */}
            <div className="grid grid-cols-2 gap-[17px] md:grid-cols-1 md:grid-rows-2">
              {articles[1] ? (
                <SideArticle article={articles[1]} />
              ) : (
                <PlaceholderSideCard tag="Coming Up" title="More news from the league soon." />
              )}
              {articles[2] ? (
                <SideArticle article={articles[2]} />
              ) : (
                <PlaceholderSideCard tag="Around the League" title="Match reports and feature stories." />
              )}
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 5: MATCH CENTRE (Tabs: LIVE/RESULTS/SCHEDULE)          */}
      {/* ------------------------------------------------------------ */}
      <section id="matches" className="bg-white py-[26px]">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <SectionHead
            eyebrow="Follow every game"
            title="Match Centre"
            subtitle="Live action, completed scorecards and upcoming fixtures."
            viewLabel="ALL MATCHES →"
            viewHref="/?view=matches"
          />

          <Tabs defaultValue="live" className="flex flex-col gap-[15px]">
            <TabsList className="h-auto w-full justify-start gap-[5px] rounded-none border-b border-league-line bg-transparent p-0">
              {([
                ["live", "LIVE"],
                ["results", "RESULTS"],
                ["schedule", "SCHEDULE"],
              ] as const).map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    "rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-[18px] py-2.5",
                    "text-[13px] font-extrabold text-[#6d7a89] shadow-none",
                    "data-[state=active]:border-cricket-red data-[state=active]:bg-transparent data-[state=active]:text-navy data-[state=active]:shadow-none",
                  )}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {([
              ["live", liveMatches],
              ["results", resultsTabData],
              ["schedule", upcomingMatches],
            ] as const).map(([value, matches]) => (
              <TabsContent key={value} value={value} className="mt-0">
                {matches.length === 0 ? (
                  <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 md:grid-cols-3">
                    <EmptyStateCard
                      message={
                        value === "live"
                          ? "No live matches right now"
                          : value === "results"
                            ? "No results yet"
                            : "No upcoming fixtures"
                      }
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 md:grid-cols-3">
                    {matches.map((m, i) => (
                      <Card
                        key={`${m.division}-${m.date}-${m.teams[0].name}-${i}`}
                        className="gap-0 rounded-lg border-league-line bg-white p-4 shadow-none"
                      >
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.8px] text-league-muted">
                          <span>
                            {m.division} · {m.date}
                          </span>
                          <StatusBadge status={m.status} label={m.statusLabel} />
                        </div>
                        <div className="my-[15px] mb-2.5 grid grid-cols-[1fr_auto] gap-[7px] text-[13px] font-bold">
                          <span className="truncate">{m.teams[0].name}</span>
                          <b className="tabular-nums">{m.teams[0].score}</b>
                          <span className="truncate">{m.teams[1].name}</span>
                          <b className="tabular-nums">{m.teams[1].score}</b>
                        </div>
                        <div className="border-t border-league-line pt-2.5 text-[11px] text-league-muted">
                          {m.foot}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 6: POINTS TABLE / STANDINGS                            */}
      {/* ------------------------------------------------------------ */}
      <section id="series" className="py-[26px]">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <SectionHead
            eyebrow={`${season} season standings`}
            title="Points Table"
            subtitle="Track the race for the top spots in every division."
            viewLabel="FULL STANDINGS →"
            viewHref="/?view=series"
          />

          {/* Division tabs (pill buttons) — single pseudo-division "Standings"
              since the data model doesn't carry intra-league divisions. */}
          <div className="mb-[13px] flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-[20px] border border-navy bg-navy px-[13px] py-[7px] text-[11px] font-semibold text-white"
            >
              Standings
            </button>
          </div>

          {standings.length === 0 ? (
            <Card className="gap-0 rounded-lg border-league-line bg-white p-6 text-center shadow-none">
              <p className="text-xs text-league-muted">
                Standings will appear after the first match
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-league-line bg-white">
              <Table className="min-w-[650px] border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-league-line hover:bg-transparent">
                    <TableHead className="h-auto bg-[#f1f4f8] px-3 py-3 text-left text-[10px] font-medium uppercase tracking-[0.7px] text-[#6b7888]">
                      Pos / Team
                    </TableHead>
                    {["Played", "Won", "Lost", "Tied", "Points", "NRR"].map((h) => (
                      <TableHead
                        key={h}
                        className="h-auto bg-[#f1f4f8] px-3 py-3 text-right text-[10px] font-medium uppercase tracking-[0.7px] text-[#6b7888]"
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((row, idx) => (
                    <TableRow
                      key={`${row.team}-${idx}`}
                      className={cn(
                        "border-b border-league-line last:border-0 hover:bg-transparent",
                        idx === 0 && "border-l-[3px] border-l-league-green",
                      )}
                    >
                      <TableCell
                        className={cn(
                          "px-3 py-3 text-left text-xs font-semibold",
                          idx === 0 && "border-l-[3px] border-l-league-green",
                        )}
                      >
                        <div className="flex items-center gap-2.5 font-extrabold">
                          <span className="inline-block w-[25px] text-league-muted">{row.pos}</span>
                          <span className="grid h-[25px] w-[25px] place-items-center rounded-md bg-[#eaf0f7] text-[10px] font-black text-navy">
                            {row.badge}
                          </span>
                          <span>{row.team}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right text-xs font-semibold tabular-nums">
                        {row.played}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right text-xs font-semibold tabular-nums">
                        {row.won}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right text-xs font-semibold tabular-nums">
                        {row.lost}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right text-xs font-semibold tabular-nums">
                        {row.tied}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right text-xs font-bold tabular-nums">
                        {row.points}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right text-xs font-semibold tabular-nums">
                        {row.nrr}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 7: PHOTO GALLERY                                       */}
      {/* ------------------------------------------------------------ */}
      <section id="teams" className="bg-white py-[26px]">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <SectionHead
            eyebrow="Moments from the boundary"
            title="League Photo Gallery"
            subtitle="Match-day action, team celebrations and the people behind the game."
            viewLabel="VIEW ALL PHOTOS →"
            viewHref="/?view=photos"
          />

          {gallery.length === 0 ? (
            <Card className="gap-0 rounded-lg border-league-line bg-white p-6 text-center shadow-none">
              <p className="text-xs text-league-muted">
                No photos yet — galleries will appear once matches are played.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 grid-rows-[150px_115px_115px] gap-2.5 sm:grid-cols-[1.35fr_1fr_1fr] sm:grid-rows-[155px_155px]">
              {gallery.slice(0, 5).map((photo, i) => (
                <a
                  key={`${photo.src}-${i}`}
                  href="/?view=photos"
                  className={cn(
                    "relative overflow-hidden rounded-lg bg-[#d8e0e8] bg-cover bg-center",
                    i === 0 && "row-span-2 sm:col-auto sm:row-span-2",
                    i === 0 && "col-span-2 sm:col-span-1",
                  )}
                  style={{ backgroundImage: `url('${photo.src}')` }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 top-[45%] bg-gradient-to-b from-transparent to-[#082818]/80"
                  />
                  <span className="absolute bottom-3 left-3.5 z-[1] text-xs font-extrabold text-white">
                    {photo.label}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 8: PLAYER STATISTICS                                   */}
      {/* ------------------------------------------------------------ */}
      <section id="statistics" className="py-[26px]">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <SectionHead
            eyebrow="Season leaders"
            title="Player Statistics"
            subtitle="Recognizing the leading performers across the league."
            viewLabel="ALL STATISTICS →"
            viewHref="/?view=stats"
          />

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
            <StatCategoryCard
              title="Top Batsmen"
              label="Most Runs"
              unit="RUNS"
              players={topBatsmen}
            />
            <StatCategoryCard
              title="Top Bowlers"
              label="Most Wickets"
              unit="WICKETS"
              players={topBowlers}
            />
            <StatCategoryCard
              title="Top Fielders"
              label="Dismissals"
              unit="DISMISSALS"
              players={topFielders}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* SECTION 9: PLAYER OF THE WEEK                                  */}
      {/* ------------------------------------------------------------ */}
      {playerOfWeek ? (
        <section id="players" className="bg-white py-[26px]">
          <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
            <SectionHead
              eyebrow="Spotlight"
              title="Player of the Week"
              viewLabel="MEET OUR PLAYERS →"
              viewHref="/?view=players"
            />

            <Card className="grid gap-0 overflow-hidden rounded-[10px] border-0 bg-navy p-0 text-white shadow-none md:grid-cols-[190px_1fr]">
              <div
                className="min-h-[180px] bg-cover bg-center md:min-h-[190px]"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1593766827228-8737b9cd6cc3?auto=format&fit=crop&w=600&q=80')",
                }}
              />
              <div className="p-5 md:p-6">
                <Tag>Player Spotlight</Tag>
                <h3 className="my-2 text-[23px] font-bold">{playerOfWeek.name}</h3>
                <p className="max-w-[650px] text-xs text-[#c5d2df]">
                  {playerOfWeek.team} · {league.format}. A leading run-scorer in the {season} campaign.
                </p>
                <div className="mt-4 flex flex-wrap gap-5 md:gap-8">
                  <div>
                    <b className="block text-[21px] font-bold">{playerOfWeek.metric}</b>
                    <small className="text-[10px] uppercase text-[#aebfd0]">Career runs</small>
                  </div>
                  <div>
                    <b className="block text-[21px] font-bold">{playerOfWeek.initials}</b>
                    <small className="text-[10px] uppercase text-[#aebfd0]">Initials</small>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      ) : (
        <section id="players" className="bg-white py-[26px]">
          <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
            <SectionHead
              eyebrow="Spotlight"
              title="Player of the Week"
              viewLabel="MEET OUR PLAYERS →"
              viewHref="/?view=players"
            />
            <Card className="gap-0 rounded-[10px] border-league-line bg-white p-6 text-center shadow-none">
              <p className="text-xs text-league-muted">
                Statistics will appear after matches are played
              </p>
            </Card>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ */}
      {/* SECTION 10: FOOTER                                             */}
      {/* ------------------------------------------------------------ */}
      <footer id="footer" className="bg-navy-dark pb-[18px] pt-[38px] text-[#d8e1ea]">
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-[35px]">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <a href="/" className="flex items-center gap-[11px]">
                <Crest initials={leagueInitials} />
                <div className="leading-[1.2]">
                  <strong className="block text-sm font-bold tracking-[0.7px] text-white">
                    {leagueName}
                  </strong>
                  <small className="mt-1 block text-[10px] tracking-[1.7px] text-[#b8c8d9]">
                    {leagueShortName}
                  </small>
                </div>
              </a>
              <p className="mt-[17px] max-w-[310px] text-xs text-[#aebdcb]">
                {league.description
                  ? league.description
                  : `Your home for league news, fixtures, results, team information and player performances across the ${season} season.`}
              </p>
              <p className="text-xs text-[#aebdcb]">
                In association with <b className="text-white">USACricketers.com</b>
              </p>
            </div>

            {/* League links */}
            <div>
              <h4 className="mb-3 text-xs uppercase tracking-[1px] text-white">League</h4>
              {["About the League", "Divisions", "Rules & Regulations", "League Officials"].map((l) => (
                <a
                  key={l}
                  href="#"
                  className="my-2 block text-xs text-[#aebdcb] hover:text-white"
                >
                  {l}
                </a>
              ))}
            </div>

            {/* Cricket links */}
            <div>
              <h4 className="mb-3 text-xs uppercase tracking-[1px] text-white">Cricket</h4>
              {["Latest News", "Matches", "Teams", "Statistics"].map((l) => (
                <a
                  key={l}
                  href={navHref(l)}
                  className="my-2 block text-xs text-[#aebdcb] hover:text-white"
                >
                  {l}
                </a>
              ))}
            </div>

            {/* Information links */}
            <div>
              <h4 className="mb-3 text-xs uppercase tracking-[1px] text-white">Information</h4>
              {[
                "Contact Us",
                "Privacy Policy",
                "Terms & Conditions",
                "Facebook · Instagram · YouTube",
              ].map((l) => (
                <a
                  key={l}
                  href="#"
                  className="my-2 block text-xs text-[#aebdcb] hover:text-white"
                >
                  {l}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-[27px] flex flex-col justify-between gap-2 border-t border-[#1a4530] pt-[15px] text-[10px] text-[#8496a8] sm:flex-row">
            <span>
              © {season} {leagueName} {leagueShortName}. All rights reserved.
            </span>
            <span>Powered by the cricket community.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section 4 sub-components (hero + side articles)                      */
/* ------------------------------------------------------------------ */

function HeroArticle({ article, season }: { article: LeagueArticle; season: string }) {
  const bg = article.imageUrl
    ? `url('${article.imageUrl}')`
    : "linear-gradient(135deg, #0d4f2c, #082818)"
  return (
    <article
      className="relative h-[360px] overflow-hidden rounded-[10px] bg-[#0d4f2c] bg-cover bg-center md:h-[390px]"
      style={{ backgroundImage: bg }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#082818]/91 via-[#082818]/60 to-transparent"
      />
      <div className="absolute bottom-[34px] left-[34px] z-[1] max-w-[570px] text-white max-sm:left-5 max-sm:right-5 max-sm:bottom-5">
        <Tag>{article.category || "League News"} · Featured</Tag>
        <h1 className="my-3.5 text-[clamp(27px,3.3vw,43px)] font-bold leading-[1.08] tracking-[-1px]">
          {article.title}
        </h1>
        <p className="mb-[17px] max-w-[500px] text-sm text-[#dce6ef]">
          {article.excerpt || `Featured coverage from the ${season} season.`}
        </p>
        <Button
          asChild
          className="rounded bg-white px-[15px] py-2.5 text-xs font-extrabold text-navy hover:bg-white/90"
        >
          <a href={`/news/${article.slug}`}>READ THE STORY →</a>
        </Button>
      </div>
    </article>
  )
}

function SideArticle({ article }: { article: LeagueArticle }) {
  const bg = article.imageUrl
    ? `url('${article.imageUrl}')`
    : "linear-gradient(135deg, #1a6b3f, #082818)"
  return (
    <article
      className="relative h-[150px] overflow-hidden rounded-[9px] bg-[#1a6b3f] bg-cover bg-center md:h-auto md:min-h-0"
      style={{ backgroundImage: bg }}
    >
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#082818]/91 to-transparent" />
      <div className="absolute bottom-[18px] left-[19px] right-[18px] z-[1] text-white">
        <Tag>{article.category || "League News"}</Tag>
        <h3 className="mt-2 text-[17px] font-bold leading-[1.2]">
          {article.title}
        </h3>
      </div>
    </article>
  )
}

function PlaceholderSideCard({ tag, title }: { tag: string; title: string }) {
  return (
    <article className="relative flex h-[150px] flex-col justify-end overflow-hidden rounded-[9px] bg-[#1a6b3f] p-4 text-white md:h-auto md:min-h-0">
      <Tag>{tag}</Tag>
      <h3 className="mt-2 text-[17px] font-bold leading-[1.2]">{title}</h3>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Section 8 sub-component (stat category card)                         */
/* ------------------------------------------------------------------ */

function StatCategoryCard({
  title,
  label,
  unit,
  players,
}: {
  title: string
  label: string
  unit: string
  players: PlayerStat[]
}) {
  return (
    <Card
      className="gap-0 rounded-[9px] border-league-line bg-white p-[17px] shadow-none"
    >
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="m-0 text-sm text-navy">{title}</h3>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.7px] text-cricket-red">
          {label}
        </span>
      </div>
      {players.length === 0 ? (
        <div className="py-[18px] text-center text-[11px] text-league-muted">
          Statistics will appear after matches are played
        </div>
      ) : (
        players.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            className={cn(
              "flex items-center gap-2.5 py-[9px]",
              i > 0 && "border-t border-[#edf0f4]",
            )}
          >
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e7edf4] text-[11px] font-black text-navy">
              {p.initials}
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-xs">{p.name}</b>
              <small className="text-[10px] text-league-muted">{p.team}</small>
            </div>
            <div className="text-right text-[17px] font-black text-navy">
              {p.metric}
              <small className="block text-[9px] font-semibold text-league-muted">
                {unit}
              </small>
            </div>
          </div>
        ))
      )}
    </Card>
  )
}

export default LeagueHomepage
