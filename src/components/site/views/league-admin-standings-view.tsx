"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, RefreshCw, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Standings view for league admins                                           */
/* -------------------------------------------------------------------------- */

interface Standing {
  teamId: string
  teamName: string
  teamShortName: string
  primaryColor: string
  accentColor: string
  played: number
  won: number
  lost: number
  tied: number
  points: number
  nrr: number
  forRuns: number
  forOvers: number
  againstRuns: number
  againstOvers: number
  penaltyPoints?: number
  penaltyNrr?: number
  effectivePoints?: number
  effectiveNrr?: number
}

export function LeagueAdminStandingsView() {
  const navigate = useAppStore((s) => s.navigate)
  const session = useLeagueAdminSession((s) => s.session)
  const [seriesList, setSeriesList] = useState<{ id: string; name: string }[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string>("")
  const [standings, setStandings] = useState<Standing[] | null>(null)
  const [loading, setLoading] = useState(true)

  // Load series list
  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch("/api/series")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const series = data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))
        setSeriesList(series)
        // Auto-select the first managed series
        const managed = session.managedSeriesIds
        const firstId = managed.find((id) => series.some((s) => s.id === id)) ?? series[0]?.id
        if (firstId) {
          setSelectedSeries(firstId)
        } else {
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [session])

  // Load standings when series changes
  useEffect(() => {
    if (!selectedSeries) return
    let cancelled = false
    fetch(`/api/standings?seriesId=${selectedSeries}`)
      .then((r) => r.json())
      .then((data: Standing[]) => { if (!cancelled) { setStandings(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setStandings([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [selectedSeries])

  if (!session) {
    return <LeagueAdminShell title="Standings"><p className="text-sm text-muted-foreground">Please sign in.</p></LeagueAdminShell>
  }

  return (
    <LeagueAdminShell title="Standings">
      {/* Series selector */}
      {seriesList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {seriesList
            .filter((s) => session.managedSeriesIds.includes(s.id) || session.managedSeriesIds.length === 0)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSeries(s.id)}
                className={cn(
                  "rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                  selectedSeries === s.id
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {s.name}
              </button>
            ))}
        </div>
      )}

      {/* Refresh button */}
      {selectedSeries && (
        <div className="flex items-center justify-between">
          <p className="font-display text-xs text-muted-foreground">
            Auto-computed from completed matches
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true)
              fetch(`/api/standings?seriesId=${selectedSeries}`)
                .then((r) => r.json())
                .then((data) => { setStandings(data); setLoading(false) })
            }}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      )}

      {/* Standings table */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : !selectedSeries ? (
        <Card className="p-8 text-center">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Select a series to view its standings.
          </p>
        </Card>
      ) : standings && standings.length > 0 ? (
        <StandingsTable standings={standings} />
      ) : (
        <Card className="p-8 text-center">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No completed matches yet. Standings will appear here once matches
            are scored and completed.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("league-admin-matches")}
            className="mt-3 gap-1.5"
          >
            Go to Schedule <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Card>
      )}
    </LeagueAdminShell>
  )
}

/* -------------------------------------------------------------------------- */
/*  Standings table component                                                  */
/* -------------------------------------------------------------------------- */

function StandingsTable({ standings }: { standings: Standing[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      {/* Header row */}
      <div className="flex items-center bg-[#f8f8f8] px-3 py-2 border-b border-gray-200">
        <span className="w-8 font-display text-xs font-bold uppercase tracking-widest text-gray-500">#</span>
        <span className="flex-1 font-display text-xs font-bold uppercase tracking-widest text-gray-500">Team</span>
        <span className="w-10 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500">P</span>
        <span className="w-10 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500">W</span>
        <span className="w-10 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500">L</span>
        <span className="w-10 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500">T</span>
        <span className="w-12 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500">Pts</span>
        <span className="w-16 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500">NRR</span>
      </div>

      {/* Rows */}
      {standings.map((s, i) => (
        <div
          key={s.teamId}
          className={cn(
            "flex items-center border-b border-gray-100 px-3 py-2.5 transition-colors last:border-0 hover:bg-muted/20",
            i === 0 && "bg-amber-50/30",
          )}
        >
          {/* Position */}
          <span
            className={cn(
              "w-8 font-display text-sm font-bold tabular-nums",
              i === 0 && "text-amber-500",
              i === 1 && "text-gray-400",
              i === 2 && "text-orange-700",
              i > 2 && "text-gray-500",
            )}
          >
            {i + 1}
          </span>

          {/* Team badge + name */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded font-display text-[8px] font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${s.primaryColor} 0%, ${s.primaryColor}cc 100%)`,
              }}
            >
              {s.teamShortName.slice(0, 2).toUpperCase()}
            </span>
            <span className="font-display text-sm font-bold truncate">{s.teamName}</span>
          </div>

          {/* Stats */}
          <span className="w-10 text-right font-display text-sm font-semibold tabular-nums text-gray-700">{s.played}</span>
          <span className="w-10 text-right font-display text-sm font-semibold tabular-nums text-emerald-600">{s.won}</span>
          <span className="w-10 text-right font-display text-sm font-semibold tabular-nums text-red-500">{s.lost}</span>
          <span className="w-10 text-right font-display text-sm font-semibold tabular-nums text-gray-500">{s.tied}</span>
          <span className="w-12 text-right font-display text-base font-black tabular-nums text-black">
            {s.effectivePoints ?? s.points}
            {!!s.penaltyPoints && (
              <span className="ml-0.5 text-[10px] font-medium text-red-500" title={`−${s.penaltyPoints} from penalties`}>
                (−{s.penaltyPoints})
              </span>
            )}
          </span>
          <span className={cn(
            "w-16 text-right font-display text-sm font-semibold tabular-nums",
            (s.effectiveNrr ?? s.nrr) > 0 ? "text-emerald-600" : (s.effectiveNrr ?? s.nrr) < 0 ? "text-red-500" : "text-gray-500",
          )}>
            {(s.effectiveNrr ?? s.nrr) > 0 ? "+" : ""}{(s.effectiveNrr ?? s.nrr).toFixed(3)}
            {!!s.penaltyNrr && s.penaltyNrr !== 0 && (
              <span className="ml-0.5 text-[10px] text-amber-600" title={`${s.penaltyNrr > 0 ? "+" : ""}${s.penaltyNrr.toFixed(3)} NRR adjustment`}>*</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
