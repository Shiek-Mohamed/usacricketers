"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useScorerSession } from "@/lib/scorer-session"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { LogOut, ChevronRight, ShieldAlert, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Match } from "@/lib/types"

export function ScorerHomeView() {
  const navigate = useAppStore((s) => s.navigate)
  const exitScorerMode = useAppStore((s) => s.exitScorerMode)
  const session = useScorerSession((s) => s.session)
  const token = session?.token ?? null
  const scorer = session?.scorer
  const tournamentIds = session?.tournamentIds ?? []
  const clear = useScorerSession((s) => s.clear)

  const [matches, setMatches] = useState<Match[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // loading is derived: when a token is present we're "loading" until the
  // matching fetch resolves. When there's no token there's nothing to load.
  const [nonce, setNonce] = useState(0)
  const [doneNonce, setDoneNonce] = useState(-1)
  const loading = token ? nonce !== doneNonce : false

  useEffect(() => {
    if (!token) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/scorer/matches", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!active) return
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again.")
          setMatches(null)
        } else if (!res.ok) {
          setError(`Failed to load matches (${res.status})`)
          setMatches(null)
        } else {
          const data = (await res.json()) as Match[]
          setMatches(data)
          setError(null)
        }
      } catch {
        if (!active) return
        setError("Network error — could not load matches")
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

  if (!session) {
    return null
  }

  function handleSignOut() {
    clear()
    exitScorerMode()
  }

  const list = matches ?? []
  const liveMatches = list.filter((m) => m.status === "live")
  const upcoming = list.filter((m) => m.status === "upcoming")
  const completed = list
    .filter((m) => m.status === "completed")
    .slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Welcome header + sign out */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Scorer
          </p>
          <h2 className="text-lg font-bold tracking-tight">
            Welcome, {scorer?.name ?? scorer?.username ?? "Scorer"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your tournaments:{" "}
            <span className="font-semibold text-foreground">
              {tournamentIds.length}
            </span>{" "}
            · {list.length} match{list.length === 1 ? "" : "s"} visible
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reload}
            disabled={loading}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Refresh matches"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
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
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <Card className="grid place-items-center p-6">
          <p className="text-sm text-muted-foreground">
            No matches available to score.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Matches will appear here once your tournament has fixtures.
          </p>
        </Card>
      )}

      {!loading && !error && list.length > 0 && (
        <>
          {/* Live matches */}
          {liveMatches.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                </span>
                Live Now ({liveMatches.length})
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {liveMatches.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    onClick={() => navigate("live-scorer", m.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Upcoming ({upcoming.length})
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {upcoming.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    onClick={() => navigate("live-scorer", m.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recently completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Recently Completed
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {completed.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    onClick={() => navigate("live-scorer", m.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MatchRow({
  match,
  onClick,
}: {
  match: Match
  onClick: () => void
}) {
  const isLive = match.status === "live"
  const t1 = match.team1
  const t2 = match.team2
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left transition-shadow hover:shadow-md",
        isLive && "border-red-300 bg-red-50"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex items-center gap-1.5">
          {t1 && (
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: t1.primaryColor }}
            >
              {t1.shortName.slice(0, 2)}
            </span>
          )}
          <span className="text-sm font-semibold">{t1?.shortName ?? "TBD"}</span>
        </div>
        <span className="text-xs text-muted-foreground">v</span>
        <div className="flex items-center gap-1.5">
          {t2 && (
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: t2.primaryColor }}
            >
              {t2.shortName.slice(0, 2)}
            </span>
          )}
          <span className="text-sm font-semibold">{t2?.shortName ?? "TBD"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{match.matchNo}</span>
        {isLive ? (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Live
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
            {match.status}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  )
}
