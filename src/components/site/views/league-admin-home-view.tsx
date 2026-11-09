"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  LogOut,
  RefreshCw,
  ShieldAlert,
  CalendarDays,
  CalendarPlus,
  Users,
  UserPlus,
  Trophy,
  Pencil,
  ChevronRight,
  Sparkles,
  Radio,
  Plus,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FormatPill, StatusPill } from "@/components/cricket/ui"
import type { Match, Series } from "@/lib/types"

/* ------------------------- inline fetch helpers ------------------------- */

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export function LeagueAdminHomeView() {
  const navigate = useAppStore((s) => s.navigate)
  const exitLeagueAdminMode = useAppStore((s) => s.exitLeagueAdminMode)
  const session = useLeagueAdminSession((s) => s.session)
  const clear = useLeagueAdminSession((s) => s.clear)
  const token = session?.token ?? null
  const admin = session?.admin
  const managedSeriesIds = session?.managedSeriesIds ?? []

  const [series, setSeries] = useState<Series[] | null>(null)
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // nonce/doneNonce pattern mirrors scorer-home-view.
  const [nonce, setNonce] = useState(0)
  const [doneNonce, setDoneNonce] = useState(-1)
  const loading = token ? nonce !== doneNonce : false

  useEffect(() => {
    if (!token) return
    let active = true
    ;(async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [seriesRes, matchesRes] = await Promise.all([
          fetch("/api/league-admin/series", { headers }),
          fetch("/api/league-admin/matches", { headers }),
        ])
        if (!active) return
        if (seriesRes.status === 401 || matchesRes.status === 401) {
          setError("Your session has expired. Please sign in again.")
          setSeries(null)
          setMatches(null)
        } else if (!seriesRes.ok || !matchesRes.ok) {
          setError("Failed to load your leagues")
          setSeries(null)
          setMatches(null)
        } else {
          const [s, m] = await Promise.all([
            seriesRes.json(),
            matchesRes.json(),
          ])
          if (!active) return
          setSeries(s as Series[])
          setMatches(m as Match[])
          setError(null)
        }
      } catch {
        if (!active) return
        setError("Network error — could not load your leagues")
        setSeries(null)
        setMatches(null)
      } finally {
        if (active) setDoneNonce(nonce)
      }
    })()
    return () => {
      active = false
    }
  }, [token, nonce])

  function reload() {
    setNonce((n) => n + 1)
  }

  const leagues = series ?? []
  const liveMatches = (matches ?? []).filter((m) => m.status === "live")
  const completedCount = (matches ?? []).filter((m) => m.status === "completed").length
  const upcomingCount = (matches ?? []).filter((m) => m.status === "upcoming").length
  const matchCountBySeries = useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of matches ?? []) {
      if (x.seriesId) m[x.seriesId] = (m[x.seriesId] ?? 0) + 1
    }
    return m
  }, [matches])

  if (!session) return null

  function handleSignOut() {
    clear()
    exitLeagueAdminMode()
  }

  return (
    <LeagueAdminShell
      title="My Leagues"
      actionLabel="+ New League"
      onAction={() => navigate("league-admin-series-edit", "new")}
    >
      {/* Live matches banner */}
      {liveMatches.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] dark:ring-1 dark:ring-white/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live Now
            </span>
            <span className="text-sm text-white/50">{liveMatches.length} match{liveMatches.length > 1 ? "es" : ""} in progress</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {liveMatches.map((m) => {
              const sc = m.scorecard
              const t1Score = sc?.innings?.filter((i) => i.teamId === m.team1Id).map((i) => `${i.totalRuns}/${i.totalWickets}`).join(" · ")
              const t2Score = sc?.innings?.filter((i) => i.teamId === m.team2Id).map((i) => `${i.totalRuns}/${i.totalWickets}`).join(" · ")
              return (
                <button
                  key={m.id}
                  onClick={() => navigate("live-scorer", m.id)}
                  className="flex min-w-[180px] flex-1 items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
                >
                  <div className="text-center">
                    <div className="text-xs font-bold uppercase text-white/70">{m.team1?.shortName}</div>
                    {t1Score ? <div className="text-sm font-extrabold text-white">{t1Score}</div> : <div className="text-xs text-white/40">—</div>}
                  </div>
                  <span className="text-xs font-bold text-white/30">vs</span>
                  <div className="text-center">
                    <div className="text-xs font-bold uppercase text-white/70">{m.team2?.shortName}</div>
                    {t2Score ? <div className="text-sm font-extrabold text-white">{t2Score}</div> : <div className="text-xs text-white/40">—</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => navigate("league-admin-matches")}>
          <Plus className="h-3.5 w-3.5" /> New Match
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("league-admin-players")}>
          <UserPlus className="h-3.5 w-3.5" /> Add Player
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("league-admin-teams")}>
          <Users className="h-3.5 w-3.5" /> Manage Teams
        </Button>
        {liveMatches.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => navigate("live-scorer", liveMatches[0].id)}>
            <Radio className="h-3.5 w-3.5" /> Score Live
          </Button>
        )}
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <Activity className="mx-auto h-4 w-4 text-red-500" />
          <div className="mt-1 text-xl font-bold tabular-nums">{liveMatches.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Live</div>
        </Card>
        <Card className="p-3 text-center">
          <CalendarDays className="mx-auto h-4 w-4 text-emerald-600" />
          <div className="mt-1 text-xl font-bold tabular-nums">{completedCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-3 text-center">
          <CalendarPlus className="mx-auto h-4 w-4 text-amber-500" />
          <div className="mt-1 text-xl font-bold tabular-nums">{upcomingCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Upcoming</div>
        </Card>
      </div>

      {/* Welcome header + sign out */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            League Administrator
          </p>
          <h2 className="text-lg font-bold tracking-tight">
            Welcome, {admin?.name ?? admin?.username ?? "Admin"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your leagues:{" "}
            <span className="font-semibold text-foreground">
              {leagues.length}
            </span>{" "}
            · {managedSeriesIds.length} managed ·{" "}
            {(matches ?? []).length} matches scheduled
          </p>
          {/* Plan badge + upgrade */}
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Free Plan
            </span>
            <button
              onClick={() => navigate("pricing")}
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-amber-600 hover:text-amber-700"
            >
              <Sparkles className="h-3 w-3" />
              Upgrade to Pro
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reload}
            disabled={loading}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Refresh leagues"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 rounded px-2 py-0.5 font-semibold text-red-700 underline-offset-2 hover:underline dark:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && !error && leagues.length === 0 && (
        <Card className="grid place-items-center p-8 text-center">
          <Trophy className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            You have no leagues yet — create one
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Click &ldquo;+ New League&rdquo; to create your first league. You
            will then be able to add teams, schedule matches and assign scorers.
          </p>
          <Button
            size="sm"
            onClick={() => navigate("league-admin-series-edit", "new")}
            className="mt-4 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            + New League
          </Button>
        </Card>
      )}

      {!loading && !error && leagues.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((s) => (
            <LeagueCard
              key={s.id}
              series={s}
              matchCount={matchCountBySeries[s.id] ?? 0}
              onOpen={() => navigate("league-admin-series-edit", s.id)}
              onSchedule={() => navigate("league-admin-matches", s.id)}
              onScorers={() => navigate("league-admin-scorers", s.id)}
            />
          ))}
        </div>
      )}
    </LeagueAdminShell>
  )
}

/* --------------------------------- bits --------------------------------- */

function LeagueCard({
  series,
  matchCount,
  onOpen,
  onSchedule,
  onScorers,
}: {
  series: Series
  matchCount: number
  onOpen: () => void
  onSchedule: () => void
  onScorers: () => void
}) {
  const start = new Date(series.startDate)
  const end = new Date(series.endDate)
  const sameYear = start.getFullYear() === end.getFullYear()
  const datesStr = `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  })} – ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-all hover:shadow-xl hover:-translate-y-0.5">
      {/* Navy gradient header — centered */}
      <div className="bg-gradient-to-r from-[#1e2a5e] to-[#2d3b7a] p-4 text-center text-white">
        <div className="mb-1.5 flex items-center justify-center gap-1.5">
          <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
            {series.shortName} · {series.season}
          </span>
        </div>
        <button
          onClick={onOpen}
          className="block w-full"
          aria-label={`Edit ${series.name}`}
        >
          <h3 className="line-clamp-2 text-base font-extrabold leading-tight tracking-tight text-white group-hover:text-amber-300 transition-colors">
            {series.name}
          </h3>
        </button>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <FormatPill format={series.format} />
          <StatusPill status={series.status} />
        </div>
      </div>

      {/* Body — centered stats + description */}
      <div className="flex flex-1 flex-col items-center gap-2.5 p-4 text-center">
        {/* Stats — bigger, bolder, centered */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1 text-sm font-bold text-foreground">
            <Users className="h-4 w-4 text-blue-600" />
            {series.teams.length} teams
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-foreground">
            <Trophy className="h-4 w-4 text-amber-600" />
            {matchCount} match{matchCount === 1 ? "" : "es"}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-foreground">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          {datesStr}
        </span>

        {series.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {series.description}
          </p>
        )}

        {/* Action buttons — Create Schedule + Add Scorers same style, same line */}
        <div className="mt-auto flex w-full flex-col items-center gap-2 border-t pt-3">
          <div className="flex w-full flex-row justify-center gap-2">
            <Button
              size="sm"
              onClick={onSchedule}
              className="gap-1.5 bg-[#1e2a5e] text-xs font-semibold text-white hover:bg-[#1e2a5e]/90"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Create Schedule
            </Button>
            <Button
              size="sm"
              onClick={onScorers}
              className="gap-1.5 bg-[#1e2a5e] text-xs font-semibold text-white hover:bg-[#1e2a5e]/90"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Scorers
            </Button>
          </div>
          {/* Edit Details — below, centered */}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpen}
            className="gap-1.5 text-xs font-semibold"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Details
          </Button>
        </div>
      </div>
    </Card>
  )
}
