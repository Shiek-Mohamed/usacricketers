"use client"

import { useState } from "react"
import type { Article, Match, Player, Series, Team } from "@/lib/types"
import { ArticleCard } from "@/components/cricket/article-card"
import {
  TeamBadge,
  StatusPill,
  FormatPill,
  formatMatchDate,
  formatMatchTime,
  timeAgo,
  PlayerAvatar,
} from "@/components/cricket/ui"
import { SidebarWidget } from "./inner-layout"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Trophy,
  CalendarDays,
  Users,
  Target,
  Disc,
  Mail,
  ChevronRight,
} from "lucide-react"

/* ------------------------- Article widgets ------------------------- */

export function ArticleListWidget({
  title = "Most Read",
  articles,
}: {
  title?: string
  articles: Article[]
}) {
  if (!articles.length) return null
  return (
    <SidebarWidget title={title}>
      <div className="space-y-3">
        {articles.slice(0, 6).map((a, i) => (
          <div key={a.id} className="flex gap-2">
            <span className="w-5 shrink-0 pt-0.5 text-base font-extrabold leading-none text-red-600/80">
              {i + 1}
            </span>
            <ArticleCard article={a} variant="compact" />
          </div>
        ))}
      </div>
    </SidebarWidget>
  )
}

export function NewsletterWidget() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setStatus("error")
      setErrorMsg("Please enter your email.")
      return
    }
    setStatus("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus("error")
        setErrorMsg(data?.error || "Something went wrong. Try again.")
        return
      }
      setStatus("success")
      setEmail("")
    } catch {
      setStatus("error")
      setErrorMsg("Network error. Please try again.")
    }
  }

  return (
    <SidebarWidget title="Newsletter">
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-4 w-4 text-emerald-600" />
          The Cricket Daily
        </div>
        <p className="text-xs text-muted-foreground">
          Get the day&apos;s biggest cricket stories, scores and analysis in your
          inbox every morning.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status !== "idle") setStatus("idle")
            }}
            placeholder="Your email"
            disabled={status === "loading"}
            className="h-8 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            aria-label="Email address"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="h-8 w-full rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
        {status === "success" && (
          <p className="text-[11px] font-medium text-emerald-600">
            ✓ Subscribed! Check your inbox.
          </p>
        )}
        {status === "error" && (
          <p className="text-[11px] font-medium text-red-600">
            {errorMsg || "Something went wrong."}
          </p>
        )}
      </div>
    </SidebarWidget>
  )
}

/* ------------------------- Match widgets ------------------------- */

export function MatchInfoWidget({ match }: { match: Match }) {
  const rows: { label: string; value: string }[] = [
    { label: "Match", value: `${match.team1?.shortName ?? ""} vs ${match.team2?.shortName ?? ""}, ${match.matchNo}` },
    { label: "Series", value: match.series?.name || match.series?.shortName || "—" },
    { label: "Format", value: match.format },
    { label: "Season", value: match.series?.season || "—" },
    { label: "Venue", value: `${match.venue}${match.city ? `, ${match.city}` : ""}` },
    { label: "Date", value: `${formatMatchDate(match.startDate)} · ${formatMatchTime(match.startDate)}` },
    ...(match.result ? [{ label: "Result", value: match.result }] : []),
    { label: "Toss", value: "—" },
    { label: "Umpires", value: "—" },
    { label: "Match Referee", value: "—" },
  ]
  return (
    <SidebarWidget title="Match Details">
      <dl className="space-y-0">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 border-b border-border/40 py-2 text-xs last:border-0"
          >
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="max-w-[60%] text-right font-medium text-foreground">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </SidebarWidget>
  )
}

export function RecentResultsWidget({
  matches,
  title = "Recent Results",
}: {
  matches: Match[]
  title?: string
}) {
  const list = matches.filter((m) => m.status === "completed").slice(0, 4)
  if (!list.length) return null
  return (
    <SidebarWidget title={title}>
      <ul className="space-y-2">
        {list.map((m) => (
          <li key={m.id}>
            <a
              href={`/matches/${m.id}`}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent"
            >
              <FormatPill format={m.format} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {m.team1?.shortName} v {m.team2?.shortName}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {m.result || formatMatchDate(m.startDate)}
                </p>
              </div>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </SidebarWidget>
  )
}

/* ------------------------- Player widgets ------------------------- */

export function PlayerSummaryWidget({ player }: { player: Player }) {
  const bs = player.battingStats
  const bw = player.bowlingStats
  return (
    <SidebarWidget title="Career Summary">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Matches" value={bs.matches} />
          <Stat label="Runs" value={bs.runs.toLocaleString()} />
          <Stat label="Average" value={bs.average.toFixed(2)} />
          <Stat label="Strike Rate" value={bs.strikeRate.toFixed(2)} />
          <Stat label="100s" value={bs.hundreds} />
          <Stat label="50s" value={bs.fifties} />
          {bw && (
            <>
              <Stat label="Wickets" value={bw.wickets} />
              <Stat label="Economy" value={bw.economy.toFixed(2)} />
            </>
          )}
        </div>
        {bw && (
          <p className="text-[11px] text-muted-foreground">
            Best bowling:{" "}
            <span className="font-semibold text-foreground">{bw.best}</span>
          </p>
        )}
      </div>
    </SidebarWidget>
  )
}

export function PlayerInfoWidget({ player }: { player: Player }) {
  const rows: { icon: React.ElementType; label: string; value: React.ReactNode }[] =
    [
      { icon: Target, label: "Batting", value: player.battingStyle },
      { icon: Disc, label: "Bowling", value: player.bowlingStyle || "—" },
      {
        icon: Users,
        label: "Team",
        value: player.team ? (
          <a
            href={`/teams/${player.team.id}`}
            className="inline-flex items-center gap-1.5 hover:text-primary"
          >
            <TeamBadge
              team={player.team}
              size="sm"
              className="!h-4 !w-4 !text-[7px]"
            />
            {player.team.name}
          </a>
        ) : (
          "—"
        ),
      },
      { icon: Trophy, label: "Role", value: player.role },
    ]
  return (
    <SidebarWidget title="Player Info">
      <dl className="space-y-2.5">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <r.icon className="h-3.5 w-3.5" />
              {r.label}
            </dt>
            <dd className="text-right font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
    </SidebarWidget>
  )
}

export function TeammatesWidget({
  players,
  excludeId,
  title = "Team-mates",
}: {
  players: Player[]
  excludeId?: string
  title?: string
}) {
  const list = players.filter((p) => p.id !== excludeId).slice(0, 5)
  if (!list.length) return null
  return (
    <SidebarWidget title={title}>
      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id}>
            <a
              href={`/players/${p.id}`}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent"
            >
              <PlayerAvatar name={p.name} team={p.team} imageUrl={p.imageUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{p.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {p.role}
                </p>
              </div>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </SidebarWidget>
  )
}

/* ------------------------- Team widgets ------------------------- */

export function SquadSummaryWidget({ players }: { players: Player[] }) {
  const groups: { label: string; match: (r: string) => boolean }[] = [
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
    { label: "All-rounders", match: (r) => r.toLowerCase().includes("all") },
    { label: "Keepers", match: (r) => r.toLowerCase().includes("wicket") },
  ]
  return (
    <SidebarWidget title="Squad Summary">
      <dl className="space-y-2">
        {groups.map((g) => {
          const count = players.filter((p) => g.match(p.role)).length
          return (
            <div
              key={g.label}
              className="flex items-center justify-between text-xs"
            >
              <dt className="text-muted-foreground">{g.label}</dt>
              <dd>
                <Badge variant="secondary" className="font-bold tabular-nums">
                  {count}
                </Badge>
              </dd>
            </div>
          )
        })}
        <div className="flex items-center justify-between border-t pt-2 text-xs font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{players.length}</span>
        </div>
      </dl>
    </SidebarWidget>
  )
}

export function TeamInfoWidget({ team }: { team: Team }) {
  return (
    <SidebarWidget title="Team Info">
      <div className="flex items-center gap-2.5">
        <TeamBadge team={team} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{team.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {team.shortName} · {team.country}
          </p>
        </div>
      </div>
      {team.description && (
        <p className="mt-2.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
          {team.description}
        </p>
      )}
    </SidebarWidget>
  )
}

/* ------------------------- Series widgets ------------------------- */

export function SeriesInfoWidget({ series }: { series: Series }) {
  return (
    <SidebarWidget title="Series Info">
      <dl className="space-y-2.5">
        <InfoRow icon={Trophy} label="Format" value={series.format} />
        <InfoRow icon={CalendarDays} label="Season" value={series.season} />
        <div className="flex items-center justify-between text-xs">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Status
          </dt>
          <dd>
            <StatusPill status={series.status} />
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3 text-xs">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Dates
          </dt>
          <dd className="text-right font-medium">
            {formatMatchDate(series.startDate)}
            <br />
            {formatMatchDate(series.endDate)}
          </dd>
        </div>
      </dl>
      {series.description && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {series.description}
        </p>
      )}
    </SidebarWidget>
  )
}

export function SeriesMatchesWidget({
  matches,
  title = "Series Matches",
}: {
  matches: Match[]
  title?: string
}) {
  if (!matches.length) return null
  return (
    <SidebarWidget title={title}>
      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.id}>
            <a
              href={`/matches/${m.id}`}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent"
            >
              <FormatPill format={m.format} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{m.matchNo}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {m.team1?.shortName} v {m.team2?.shortName}
                </p>
              </div>
              <StatusPill status={m.status} />
            </a>
          </li>
        ))}
      </ul>
    </SidebarWidget>
  )
}

/* ------------------------- helpers ------------------------- */

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5 text-center">
      <p className="text-sm font-extrabold tabular-nums text-foreground">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
