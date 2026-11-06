"use client"

import { useMemo, useState } from "react"
import { usePlayers } from "@/lib/use-data"
import { parseBattingStats, parseBowlingStats, type Player } from "@/lib/types"
import { TeamBadge } from "@/components/cricket/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Trophy, TrendingUp, BarChart3 } from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  Rankings computation                                                      */
/* -------------------------------------------------------------------------- */

interface RankedPlayer {
  player: Player
  value: number
  display: string
  secondary: string
}

function computeBattingRankings(
  players: Player[],
  category: "runs" | "average" | "strikeRate" | "sixes" | "fours" | "hundreds",
): RankedPlayer[] {
  const minInnings = category === "average" ? 5 : 1
  const minBalls = category === "strikeRate" ? 50 : 0

  return players
    .map((player) => {
      const stats = parseBattingStats(
        typeof player.battingStats === "string"
          ? player.battingStats
          : JSON.stringify(player.battingStats),
      )
      const innings = stats.innings || 0
      const balls = stats.matches * 10 // approx — we don't have total balls
      if (innings < minInnings || balls < minBalls) return null

      let value = 0
      let display = ""
      let secondary = ""

      switch (category) {
        case "runs":
          value = stats.runs
          display = `${stats.runs}`
          secondary = `${innings} inn · avg ${stats.average.toFixed(1)}`
          break
        case "average":
          value = stats.average
          display = stats.average.toFixed(2)
          secondary = `${stats.runs} runs · ${innings} inn`
          break
        case "strikeRate":
          value = stats.strikeRate
          display = stats.strikeRate.toFixed(1)
          secondary = `${stats.runs} runs · ${innings} inn`
          break
        case "sixes":
          value = stats.sixes
          display = `${stats.sixes}`
          secondary = `${stats.runs} runs · ${stats.fours}×4`
          break
        case "fours":
          value = stats.fours
          display = `${stats.fours}`
          secondary = `${stats.runs} runs · ${stats.sixes}×6`
          break
        case "hundreds":
          value = stats.hundreds * 100 + stats.fifties
          display = `${stats.hundreds}×100 ${stats.fifties}×50`
          secondary = `${stats.runs} runs · avg ${stats.average.toFixed(1)}`
          break
      }
      return { player, value, display, secondary }
    })
    .filter((x): x is RankedPlayer => x !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 20)
}

function computeBowlingRankings(
  players: Player[],
  category: "wickets" | "economy" | "average" | "strikeRate",
): RankedPlayer[] {
  const minBalls = category === "economy" ? 30 : 12

  return players
    .map((player) => {
      const stats = parseBowlingStats(
        typeof player.bowlingStats === "string"
          ? player.bowlingStats
          : JSON.stringify(player.bowlingStats),
      )
      if (!stats || stats.balls < minBalls) return null

      let value = 0
      let display = ""
      let secondary = ""

      switch (category) {
        case "wickets":
          value = stats.wickets
          display = `${stats.wickets}`
          secondary = `${(stats.balls / 6).toFixed(1)} ov · econ ${stats.economy.toFixed(2)}`
          break
        case "economy":
          // Lower is better — invert for sorting
          value = -stats.economy
          display = stats.economy.toFixed(2)
          secondary = `${stats.wickets} wkts · ${(stats.balls / 6).toFixed(1)} ov`
          break
        case "average":
          value = -stats.average // Lower is better
          display = stats.average.toFixed(2)
          secondary = `${stats.wickets} wkts · econ ${stats.economy.toFixed(2)}`
          break
        case "strikeRate":
          value = -stats.strikeRate // Lower is better
          display = stats.strikeRate.toFixed(1)
          secondary = `${stats.wickets} wkts · ${(stats.balls / 6).toFixed(1)} ov`
          break
      }
      return { player, value, display, secondary }
    })
    .filter((x): x is RankedPlayer => x !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 20)
}

function computeAllRounderRankings(players: Player[]): RankedPlayer[] {
  return players
    .map((player) => {
      const bat = parseBattingStats(
        typeof player.battingStats === "string"
          ? player.battingStats
          : JSON.stringify(player.battingStats),
      )
      const bowl = parseBowlingStats(
        typeof player.bowlingStats === "string"
          ? player.bowlingStats
          : JSON.stringify(player.bowlingStats),
      )
      // Must have both batting + bowling contributions
      if (!bowl || bat.runs < 50 || bowl.wickets < 1) return null

      // All-rounder index: batting points (runs/25) + bowling points (wickets*10)
      const batPoints = bat.runs / 25
      const bowlPoints = bowl.wickets * 10
      const index = batPoints + bowlPoints

      return {
        player,
        value: index,
        display: index.toFixed(1),
        secondary: `${bat.runs} runs · ${bowl.wickets} wkts`,
      }
    })
    .filter((x): x is RankedPlayer => x !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 20)
}

/* -------------------------------------------------------------------------- */
/*  Main view                                                                  */
/* -------------------------------------------------------------------------- */

const BATTING_CATEGORIES = [
  { key: "runs", label: "Most Runs" },
  { key: "average", label: "Best Average" },
  { key: "strikeRate", label: "Best SR" },
  { key: "sixes", label: "Most Sixes" },
  { key: "fours", label: "Most Fours" },
  { key: "hundreds", label: "100s & 50s" },
] as const

const BOWLING_CATEGORIES = [
  { key: "wickets", label: "Most Wickets" },
  { key: "economy", label: "Best Economy" },
  { key: "average", label: "Best Average" },
  { key: "strikeRate", label: "Best SR" },
] as const

export function RankingsView() {
  const { data: players, loading } = usePlayers()
  const [tab, setTab] = useState<"batting" | "bowling" | "allrounder">("batting")
  const [batCat, setBatCat] = useState<(typeof BATTING_CATEGORIES)[number]["key"]>("runs")
  const [bowlCat, setBowlCat] = useState<(typeof BOWLING_CATEGORIES)[number]["key"]>("wickets")

  const rankings = useMemo(() => {
    if (!players) return []
    if (tab === "batting") return computeBattingRankings(players, batCat)
    if (tab === "bowling") return computeBowlingRankings(players, bowlCat)
    return computeAllRounderRankings(players)
  }, [players, tab, batCat, bowlCat])

  const categories = tab === "batting" ? BATTING_CATEGORIES : BOWLING_CATEGORIES
  const activeCat = tab === "batting" ? batCat : bowlCat

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-amber-500" />
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
          Player Rankings
        </h1>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["batting", "bowling", "allrounder"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 font-display text-sm font-bold uppercase tracking-wide transition-colors",
              tab === t
                ? "bg-[#1e2a5e] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "allrounder" ? "All-Rounder" : t}
          </button>
        ))}
      </div>

      {/* Category selector (not shown for all-rounder) */}
      {tab !== "allrounder" && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => (tab === "batting" ? setBatCat(cat.key) : setBowlCat(cat.key))}
              className={cn(
                "rounded-full px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                activeCat === cat.key
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : rankings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No players qualify for this ranking yet. Stats are computed from
            recorded match data.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {/* Column headers */}
          <div className="flex items-center gap-2 bg-[#f8f8f8] px-4 py-2 border-b border-gray-200">
            <span className="w-8 font-display text-xs font-bold uppercase tracking-widest text-gray-500">#</span>
            <span className="flex-1 font-display text-xs font-bold uppercase tracking-widest text-gray-500">Player</span>
            <span className="w-24 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500">Value</span>
            <span className="hidden w-48 text-right font-display text-xs font-bold uppercase tracking-widest text-gray-500 sm:block">Details</span>
          </div>

          {/* Rows */}
          {rankings.map((rp, i) => (
            <a
              key={rp.player.id}
              href={rp.player.id ? `/players/${rp.player.id}` : "#"}
              className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-muted/30 last:border-0"
            >
              {/* Rank */}
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

              {/* Player name + team badge */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {rp.player.team && (
                  <TeamBadge team={rp.player.team} size="sm" />
                )}
                <span className="font-display text-base font-bold text-black truncate">
                  {rp.player.name}
                </span>
                {rp.player.isCaptain && <span className="text-xs text-gray-500">(c)</span>}
                {rp.player.isKeeper && <span className="text-xs text-gray-500">†</span>}
              </div>

              {/* Value */}
              <span className="w-24 text-right font-display text-base font-black tabular-nums text-black">
                {rp.display}
              </span>

              {/* Secondary stats */}
              <span className="hidden w-48 text-right font-display text-xs font-semibold tabular-nums text-gray-600 sm:block">
                {rp.secondary}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Info note */}
      <p className="text-center text-xs text-muted-foreground">
        Rankings are computed from career statistics. Per-season + per-competition
        rankings will be available once the deliveries table is built (DB Phase 3).
      </p>
    </div>
  )
}
