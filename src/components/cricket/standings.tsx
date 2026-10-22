"use client"

import { useMemo } from "react"
import { useAppStore } from "@/lib/store"
import type { Match, Team } from "@/lib/types"
import { TeamBadge } from "./ui"

interface StandingRow {
  teamId: string
  team: Team | undefined
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  runsFor: number
  oversFaced: number
  runsAgainst: number
  oversBowled: number
  nrr: number
}

/**
 * Determine the outcome of a match (W/L/T/NR) from the result string +
 * scorecard data. Returns { team1Result, team2Result } or null.
 */
function matchOutcome(match: Match): { team1: "W" | "L" | "T" | "NR"; team2: "W" | "L" | "T" | "NR" } | null {
  const result = (match.result || "").toLowerCase()
  if (!result || result === "no result" || result.includes("abandoned") || result.includes("no play")) {
    return { team1: "NR", team2: "NR" }
  }
  if (result.includes("tied")) {
    return { team1: "T", team2: "T" }
  }
  // Try to determine the winner from the result text ("X won by ...")
  const t1 = match.team1
  const t2 = match.team2
  if (!t1 || !t2) return null
  const t1Won = result.includes(t1.name.toLowerCase()) || result.includes(t1.shortName.toLowerCase())
  const t2Won = result.includes(t2.name.toLowerCase()) || result.includes(t2.shortName.toLowerCase())
  if (t1Won && !t2Won) return { team1: "W", team2: "L" }
  if (t2Won && !t1Won) return { team1: "L", team2: "W" }
  // Fallback: compare scorecard totals
  const sc = match.scorecard
  if (sc?.innings?.length >= 2) {
    const inn = sc.innings
    const lastInn = inn[inn.length - 1]
    const firstInn = inn[0]
    if (lastInn.totalRuns > firstInn.totalRuns) {
      return lastInn.teamId === match.team1Id
        ? { team1: "W", team2: "L" }
        : { team1: "L", team2: "W" }
    }
    if (lastInn.totalRuns < firstInn.totalRuns) {
      return lastInn.teamId === match.team1Id
        ? { team1: "L", team2: "W" }
        : { team1: "W", team2: "L" }
    }
    return { team1: "T", team2: "T" }
  }
  return null
}

export function Standings({
  matches,
}: {
  matches: Match[]
  teams?: Team[]
}) {
  const navigate = useAppStore((s) => s.navigate)

  const rows = useMemo(() => {
    // Derive teams from the matches themselves (team1/team2) — more robust
    // than relying on the TournamentTeam join being populated.
    const teamMap = new Map<string, Team>()
    for (const m of matches) {
      if (m.team1) teamMap.set(m.team1Id, m.team1)
      if (m.team2) teamMap.set(m.team2Id, m.team2)
    }

    const map = new Map<string, StandingRow>()
    for (const [teamId, team] of teamMap) {
      map.set(teamId, {
        teamId,
        team,
        played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
        runsFor: 0, oversFaced: 0, runsAgainst: 0, oversBowled: 0, nrr: 0,
      })
    }
    for (const m of matches) {
      if (m.status !== "completed") continue
      const outcome = matchOutcome(m)
      if (!outcome) continue
      const entries: [string, string][] = [[m.team1Id, outcome.team1], [m.team2Id, outcome.team2]]
      for (const [teamId, res] of entries) {
        const row = map.get(teamId)
        if (!row) continue
        row.played++
        if (res === "W") { row.won++; row.points += 2 }
        else if (res === "L") row.lost++
        else if (res === "T") { row.tied++; row.points += 1 }
        else if (res === "NR") { row.noResult++; row.points += 1 }
        // NRR data
        const sc = m.scorecard
        if (sc?.innings) {
          for (const inn of sc.innings) {
            if (inn.teamId === teamId) {
              row.runsFor += inn.totalRuns
              row.oversFaced += parseFloat(inn.totalOvers) || 0
            } else {
              row.runsAgainst += inn.totalRuns
              row.oversBowled += parseFloat(inn.totalOvers) || 0
            }
          }
        }
      }
    }
    // Compute NRR = (runsFor / oversFaced) - (runsAgainst / oversBowled)
    for (const row of map.values()) {
      const rpo = row.oversFaced > 0 ? row.runsFor / row.oversFaced : 0
      const rpoAgainst = row.oversBowled > 0 ? row.runsAgainst / row.oversBowled : 0
      row.nrr = rpo - rpoAgainst
    }
    return Array.from(map.values())
      .filter(r => r.played > 0)
      .sort((a, b) => b.points - a.points || b.won - a.won || b.nrr - a.nrr)
  }, [matches])

  if (rows.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between bg-[#1e2a5e] px-4 py-2.5 text-white">
        <span className="text-sm font-bold uppercase tracking-wide">Standings</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-4 pr-2 text-left font-semibold">#</th>
              <th className="py-2 px-2 text-left font-semibold">Team</th>
              <th className="py-2 px-2 text-right font-semibold">P</th>
              <th className="py-2 px-2 text-right font-semibold">W</th>
              <th className="py-2 px-2 text-right font-semibold">L</th>
              <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">T</th>
              <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">NR</th>
              <th className="py-2 px-2 text-right font-semibold">Pts</th>
              <th className="py-2 pl-2 pr-4 text-right font-semibold hidden md:table-cell">NRR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.teamId}
                className={`border-b border-border/40 ${i % 2 === 1 ? "bg-muted/15" : ""} ${
                  i === 0 ? "font-semibold" : ""
                }`}
              >
                <td className="py-2 pl-4 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => r.team && navigate("team-detail", r.team.id)}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {r.team && <TeamBadge team={r.team} size="sm" />}
                    <span className="font-medium">{r.team?.shortName ?? "—"}</span>
                  </button>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{r.played}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.won}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.lost}</td>
                <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{r.tied}</td>
                <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{r.noResult}</td>
                <td className="py-2 px-2 text-right tabular-nums font-bold">{r.points}</td>
                <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                  {r.nrr !== 0 ? r.nrr.toFixed(3) : "0.000"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
