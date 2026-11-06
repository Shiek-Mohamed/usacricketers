"use client"

import { useEffect, useState, useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3, Newspaper, TrendingUp, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Player, Match } from "@/lib/types"
import { parseBattingStats, parseBowlingStats } from "@/lib/types"

interface SeriesItem { id: string; name: string; shortName: string }

export function LeagueAdminStatsView() {
  const session = useLeagueAdminSession((s) => s.session)
  const [series, setSeries] = useState<SeriesItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch("/api/series")
      .then((r) => r.json())
      .then((data: SeriesItem[]) => {
        if (cancelled) return
        const managed = data.filter((s: SeriesItem) => session.managedSeriesIds.includes(s.id))
        const list = managed.length > 0 ? managed : data
        setSeries(list)
        if (list.length > 0) setSelectedId(list[0].id)
        else setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    Promise.all([
      fetch("/api/players").then((r) => r.json()),
      fetch(`/api/matches?seriesId=${selectedId}`).then((r) => r.json()).catch(() => []),
    ])
      .then(([p, m]: [Player[], Match[]]) => {
        if (cancelled) return
        setPlayers(p)
        setMatches(Array.isArray(m) ? m : [])
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  // Compute batting leaders
  const battingLeaders = useMemo(() => {
    return players
      .map((p) => {
        const stats = parseBattingStats(typeof p.battingStats === "string" ? p.battingStats : JSON.stringify(p.battingStats))
        return { player: p, stats }
      })
      .filter((x) => x.stats.innings > 0)
      .sort((a, b) => b.stats.runs - a.stats.runs)
      .slice(0, 10)
  }, [players])

  // Compute bowling leaders
  const bowlingLeaders = useMemo(() => {
    return players
      .map((p) => {
        const stats = parseBowlingStats(typeof p.bowlingStats === "string" ? p.bowlingStats : JSON.stringify(p.bowlingStats))
        if (!stats || stats.wickets === 0) return null
        return { player: p, stats }
      })
      .filter((x): x is { player: Player; stats: NonNullable<ReturnType<typeof parseBowlingStats>> } => x !== null)
      .sort((a, b) => b.stats.wickets - a.stats.wickets)
      .slice(0, 10)
  }, [players])

  // Match summary
  const matchSummary = useMemo(() => {
    const completed = matches.filter((m) => m.status === "completed").length
    const live = matches.filter((m) => m.status === "live").length
    const upcoming = matches.filter((m) => m.status === "upcoming").length
    return { total: matches.length, completed, live, upcoming }
  }, [matches])

  if (!session) {
    return <LeagueAdminShell title="Stats & Reports"><p className="text-sm text-muted-foreground">Please sign in.</p></LeagueAdminShell>
  }

  return (
    <LeagueAdminShell title="Stats & Reports">
      {/* Series selector */}
      {series.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {series.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedId(s.id); setLoading(true) }}
              className={cn(
                "rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                selectedId === s.id ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {s.shortName}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Match Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total" value={matchSummary.total} icon={BarChart3} color="text-[#1e2a5e]" />
            <SummaryCard label="Completed" value={matchSummary.completed} icon={Trophy} color="text-emerald-600" />
            <SummaryCard label="Live" value={matchSummary.live} icon={TrendingUp} color="text-red-500" />
            <SummaryCard label="Upcoming" value={matchSummary.upcoming} icon={Newspaper} color="text-amber-500" />
          </div>

          {/* Batting + Bowling Leaders — side by side on desktop */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Batting Leaders */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 bg-[#f8f8f8] px-4 py-2 border-b border-gray-200">
                <span className="h-4 w-1 rounded-full bg-emerald-500" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#1e2a5e]">Batting Leaders — Most Runs</h3>
              </div>
              {battingLeaders.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {battingLeaders.map((item, i) => (
                    <div key={item.player.id} className="flex items-center gap-3 px-4 py-2">
                      <span className={cn("w-6 font-display text-sm font-bold tabular-nums", i < 3 ? "text-amber-500" : "text-gray-400")}>{i + 1}</span>
                      <span className="flex-1 font-display text-sm font-bold truncate">{item.player.name}</span>
                      <span className="font-display text-sm font-black tabular-nums">{item.stats.runs}</span>
                      <span className="hidden text-xs text-muted-foreground lg:block">{item.stats.innings} inn · avg {item.stats.average.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">No batting data yet.</p>}
            </Card>

            {/* Bowling Leaders */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 bg-[#f8f8f8] px-4 py-2 border-b border-gray-200">
                <span className="h-4 w-1 rounded-full bg-red-500" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#1e2a5e]">Bowling Leaders — Most Wickets</h3>
              </div>
              {bowlingLeaders.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {bowlingLeaders.map((item, i) => (
                    <div key={item.player.id} className="flex items-center gap-3 px-4 py-2">
                      <span className={cn("w-6 font-display text-sm font-bold tabular-nums", i < 3 ? "text-amber-500" : "text-gray-400")}>{i + 1}</span>
                      <span className="flex-1 font-display text-sm font-bold truncate">{item.player.name}</span>
                      <span className="font-display text-sm font-black tabular-nums">{item.stats.wickets}</span>
                      <span className="hidden text-xs text-muted-foreground lg:block">econ {item.stats.economy.toFixed(2)} · {(item.stats.balls / 6).toFixed(1)} ov</span>
                    </div>
                  ))}
                </div>
              ) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">No bowling data yet.</p>}
            </Card>
          </div>
        </div>
      )}
    </LeagueAdminShell>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <Card className="p-3 text-center">
      <Icon className={cn("mx-auto h-5 w-5", color)} />
      <div className={cn("mt-1 font-display text-2xl font-black tabular-nums", color)}>{value}</div>
      <div className="font-display text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </Card>
  )
}
