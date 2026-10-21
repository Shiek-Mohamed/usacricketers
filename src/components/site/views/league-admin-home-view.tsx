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
  Users,
  Trophy,
  ChevronRight,
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
    <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          aria-label={`Edit ${series.name}`}
        >
          <h3 className="line-clamp-2 text-sm font-bold tracking-tight text-foreground hover:text-emerald-700">
            {series.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {series.shortName} · {series.season}
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <FormatPill format={series.format} />
          <StatusPill status={series.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {series.teams.length} teams
        </span>
        <span className="inline-flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" />
          {matchCount} match{matchCount === 1 ? "" : "es"}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {datesStr}
        </span>
      </div>

      {series.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {series.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onOpen}
          className="gap-1.5 text-xs"
        >
          Edit
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onSchedule}
          className="gap-1.5 text-xs"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Schedule
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onScorers}
          className="gap-1.5 text-xs"
        >
          <Users className="h-3.5 w-3.5" />
          Scorers
        </Button>
      </div>
    </Card>
  )
}
