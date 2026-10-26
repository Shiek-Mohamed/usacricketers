"use client"

import { useState } from "react"
import { usePlayers, useTeams } from "@/lib/use-data"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayerAvatar } from "@/components/cricket/ui"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { BarChart3, GitCompareArrows, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Player } from "@/lib/types"

export function PlayerComparisonView() {
  const teams = useTeams()
  const allPlayers = usePlayers()
  const [playerAId, setPlayerAId] = useState<string>("")
  const [playerBId, setPlayerBId] = useState<string>("")

  const players = allPlayers.data ?? []
  const playerA = players.find((p) => p.id === playerAId)
  const playerB = players.find((p) => p.id === playerBId)

  const showComparison = playerA && playerB

  return (
    <InnerPageLayout
      title="Player Comparison"
      subtitle="Side-by-side batting & bowling stats"
      icon={GitCompareArrows}
    >
      {/* Picker row */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Player A */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Player 1
              </label>
              <Select value={playerAId} onValueChange={setPlayerAId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a player…" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.team?.shortName ?? "?"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {playerA && <PlayerCard player={playerA} />}
            </div>

            {/* Player B */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Player 2
              </label>
              <Select value={playerBId} onValueChange={setPlayerBId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a player…" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.team?.shortName ?? "?"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {playerB && <PlayerCard player={playerB} />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      {showComparison && (
        <ComparisonTable playerA={playerA} playerB={playerB} />
      )}

      {!showComparison && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <GitCompareArrows className="mx-auto h-8 w-8 mb-3 opacity-50" />
            Select two players above to see a side-by-side comparison.
          </CardContent>
        </Card>
      )}
    </InnerPageLayout>
  )
}

function PlayerCard({ player }: { player: Player }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
      <PlayerAvatar player={player} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{player.name}</div>
        <div className="text-xs text-muted-foreground">
          {player.role} · {player.team?.shortName ?? "?"}
        </div>
      </div>
    </div>
  )
}

function ComparisonTable({ playerA, playerB }: { playerA: Player; playerB: Player }) {
  const batA = playerA.battingStats
  const batB = playerB.battingStats

  const batStats: { label: string; a: number; b: number; format?: (v: number) => string; higherBetter: boolean }[] = [
    { label: "Matches", a: batA.matches, b: batB.matches, higherBetter: true },
    { label: "Innings", a: batA.innings, b: batB.innings, higherBetter: true },
    { label: "Runs", a: batA.runs, b: batB.runs, higherBetter: true },
    { label: "Highest Score", a: parseFloat(batA.highest) || 0, b: parseFloat(batB.highest) || 0, higherBetter: true },
    { label: "Average", a: batA.average, b: batB.average, format: (v) => v.toFixed(2), higherBetter: true },
    { label: "Strike Rate", a: batA.strikeRate, b: batB.strikeRate, format: (v) => v.toFixed(2), higherBetter: true },
    { label: "100s", a: batA.hundreds, b: batB.hundreds, higherBetter: true },
    { label: "50s", a: batA.fifties, b: batB.fifties, higherBetter: true },
    { label: "4s", a: batA.fours, b: batB.fours, higherBetter: true },
    { label: "6s", a: batA.sixes, b: batB.sixes, higherBetter: true },
    { label: "Not Outs", a: batA.notOuts, b: batB.notOuts, higherBetter: false },
  ]

  const bowlA = playerA.bowlingStats
  const bowlB = playerB.bowlingStats

  const bowlStats: { label: string; a: number; b: number; format?: (v: number) => string; higherBetter: boolean }[] = bowlA && bowlB ? [
    { label: "Matches", a: bowlA.matches, b: bowlB.matches, higherBetter: true },
    { label: "Innings", a: bowlA.innings, b: bowlB.innings, higherBetter: true },
    { label: "Balls", a: bowlA.balls, b: bowlB.balls, higherBetter: false },
    { label: "Runs", a: bowlA.runs, b: bowlB.runs, higherBetter: false },
    { label: "Wickets", a: bowlA.wickets, b: bowlB.wickets, higherBetter: true },
    { label: "Best", a: parseFloat(bowlA.best?.split("/")[0] ?? "0") || 0, b: parseFloat(bowlB.best?.split("/")[0] ?? "0") || 0, higherBetter: true },
    { label: "Economy", a: bowlA.economy, b: bowlB.economy, format: (v) => v.toFixed(2), higherBetter: false },
    { label: "Average", a: bowlA.average, b: bowlB.average, format: (v) => v.toFixed(2), higherBetter: false },
    { label: "Strike Rate", a: bowlA.strikeRate, b: bowlB.strikeRate, format: (v) => v.toFixed(2), higherBetter: false },
    { label: "Maidens", a: bowlA.maidens, b: bowlB.maidens, higherBetter: true },
  ] : []

  return (
    <div className="space-y-4">
      {/* Batting comparison */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-emerald-600" /> Batting Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 text-left">Stat</th>
                  <th className="px-4 py-2 text-right">{playerA.name}</th>
                  <th className="px-4 py-2 text-right">{playerB.name}</th>
                  <th className="px-4 py-2 text-center">Advantage</th>
                </tr>
              </thead>
              <tbody>
                {batStats.map((s, i) => {
                  const fmt = s.format ?? ((v: number) => String(v))
                  const aBetter = s.higherBetter ? s.a > s.b : s.a < s.b
                  const bBetter = s.higherBetter ? s.b > s.a : s.b < s.a
                  return (
                    <tr key={i} className={cn("border-b", i % 2 === 1 && "bg-muted/10")}>
                      <td className="px-4 py-2 font-medium">{s.label}</td>
                      <td className={cn("px-4 py-2 text-right tabular-nums", aBetter && "font-bold text-emerald-600")}>
                        {fmt(s.a)}
                      </td>
                      <td className={cn("px-4 py-2 text-right tabular-nums", bBetter && "font-bold text-emerald-600")}>
                        {fmt(s.b)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {aBetter && s.a !== s.b && <span className="text-emerald-600">◀</span>}
                        {bBetter && s.a !== s.b && <span className="text-emerald-600">▶</span>}
                        {s.a === s.b && <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bowling comparison (only if both have bowling stats) */}
      {bowlStats.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-rose-600" /> Bowling Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2 text-left">Stat</th>
                    <th className="px-4 py-2 text-right">{playerA.name}</th>
                    <th className="px-4 py-2 text-right">{playerB.name}</th>
                    <th className="px-4 py-2 text-center">Advantage</th>
                  </tr>
                </thead>
                <tbody>
                  {bowlStats.map((s, i) => {
                    const fmt = s.format ?? ((v: number) => String(v))
                    const aBetter = s.higherBetter ? s.a > s.b : s.a < s.b
                    const bBetter = s.higherBetter ? s.b > s.a : s.b < s.a
                    return (
                      <tr key={i} className={cn("border-b", i % 2 === 1 && "bg-muted/10")}>
                        <td className="px-4 py-2 font-medium">{s.label}</td>
                        <td className={cn("px-4 py-2 text-right tabular-nums", aBetter && "font-bold text-emerald-600")}>
                          {fmt(s.a)}
                        </td>
                        <td className={cn("px-4 py-2 text-right tabular-nums", bBetter && "font-bold text-emerald-600")}>
                          {fmt(s.b)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {aBetter && s.a !== s.b && <span className="text-emerald-600">◀</span>}
                          {bBetter && s.a !== s.b && <span className="text-emerald-600">▶</span>}
                          {s.a === s.b && <span className="text-muted-foreground/40">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual bar comparison for key stats */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Visual Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <BarRow label="Runs" a={batA.runs} b={batB.runs} nameA={playerA.name} nameB={playerB.name} />
          <BarRow label="Average" a={batA.average} b={batB.average} nameA={playerA.name} nameB={playerB.name} format={(v) => v.toFixed(2)} />
          <BarRow label="Strike Rate" a={batA.strikeRate} b={batB.strikeRate} nameA={playerA.name} nameB={playerB.name} format={(v) => v.toFixed(2)} />
          {bowlA && bowlB && (
            <BarRow label="Wickets" a={bowlA.wickets} b={bowlB.wickets} nameA={playerA.name} nameB={playerB.name} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BarRow({
  label, a, b, nameA, nameB, format,
}: {
  label: string
  a: number
  b: number
  nameA: string
  nameB: string
  format?: (v: number) => string
}) {
  const max = Math.max(a, b, 1)
  const pctA = (a / max) * 100
  const pctB = (b / max) * 100
  const fmt = format ?? ((v: number) => String(Math.round(v)))

  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{nameA}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctA}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums">{fmt(a)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{nameB}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${pctB}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums">{fmt(b)}</span>
        </div>
      </div>
    </div>
  )
}
