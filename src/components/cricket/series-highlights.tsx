"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { Match, Innings, BattingLine } from "@/lib/types"

/**
 * SeriesHighlights — aggregate tournament stats grid (CricClub-style
 * "Series Highlights" section on the series Overview tab).
 *
 * Computes batting/bowling/fielding aggregates across every completed match
 * in the series by parsing each match's scorecard. Pure client-side — the
 * series page already loads the matches + scorecards via useMatches(), so
 * no extra API call is needed.
 *
 * Stats computed:
 *   - Batting: 4s, 6s, 50s, 100s, Ducks, Highest Score
 *   - Bowling: Maidens, 5W, 4W, Best Bowling Figures
 *   - Fielding/extras: Catches, Run Outs, Wides, No Balls
 *   - Team: Highest Team Score, Lowest Team Score
 *   - Total Matches (completed, with a scorecard)
 *
 * Renders nothing when there are no completed matches with scorecards
 * (keeps the page clean for not-yet-started series).
 */
export function SeriesHighlights({ matches }: { matches: Match[] }) {
  const stats = useMemo(() => computeHighlights(matches), [matches])

  // Hide the whole section until at least one completed match with a
  // scorecard exists — avoids a wall of zeros for upcoming series.
  if (stats.totalMatches === 0) return null

  const battingTiles: Tile[] = [
    { label: "Total Matches", value: String(stats.totalMatches) },
    { label: "4s", value: String(stats.fours) },
    { label: "6s", value: String(stats.sixes) },
    { label: "50s", value: String(stats.fifties) },
    { label: "100s", value: String(stats.hundreds) },
    { label: "Ducks", value: String(stats.ducks) },
  ]
  const bowlingTiles: Tile[] = [
    { label: "Maidens", value: String(stats.maidens) },
    { label: "5W", value: String(stats.fiveWickets) },
    { label: "4W", value: String(stats.fourWickets) },
    { label: "Catches", value: String(stats.catches) },
    { label: "Run Outs", value: String(stats.runOuts) },
    { label: "Wides", value: String(stats.wides) },
    { label: "No Balls", value: String(stats.noBalls) },
  ]
  const highlightCards: Tile[] = [
    { label: "Highest Team Score", value: stats.highestTeamScore },
    { label: "Lowest Team Score", value: stats.lowestTeamScore },
    { label: "Highest Score", value: stats.highestScore },
    { label: "Best Bowling", value: stats.bestBowling },
  ]

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3 sm:px-6">
        <BarChart3 className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          Series Highlights
        </h2>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {/* Batting + bowling stat tiles */}
        <TileGroup label="Batting" tiles={battingTiles} />
        <TileGroup label="Bowling & Fielding" tiles={bowlingTiles} />

        {/* Highlight cards — wider, label-left / value-right */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {highlightCards.map((c) => (
            <div
              key={c.label}
              className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5"
            >
              <span className="text-xs font-medium text-muted-foreground">
                {c.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {c.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ----------------------------- sub-components ----------------------------- */

interface Tile {
  label: string
  value: string
}

function TileGroup({ label, tiles }: { label: string; tiles: Tile[] }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg border bg-card px-2 py-3 text-center"
          >
            <div className="text-xl font-bold tabular-nums text-foreground">
              {t.value}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------- aggregation ------------------------------- */

interface HighlightStats {
  totalMatches: number
  fours: number
  sixes: number
  fifties: number
  hundreds: number
  ducks: number
  maidens: number
  fiveWickets: number
  fourWickets: number
  catches: number
  runOuts: number
  wides: number
  noBalls: number
  highestTeamScore: string
  lowestTeamScore: string
  highestScore: string
  bestBowling: string
}

const EMPTY: HighlightStats = {
  totalMatches: 0,
  fours: 0,
  sixes: 0,
  fifties: 0,
  hundreds: 0,
  ducks: 0,
  maidens: 0,
  fiveWickets: 0,
  fourWickets: 0,
  catches: 0,
  runOuts: 0,
  wides: 0,
  noBalls: 0,
  highestTeamScore: "—",
  lowestTeamScore: "—",
  highestScore: "—",
  bestBowling: "—",
}

/**
 * Walk every completed match's scorecard and aggregate the CricClub-style
 * "Series Highlights" stats. See the component docstring for the full list.
 */
function computeHighlights(matches: Match[]): HighlightStats {
  const completed = matches.filter(
    (m) => m.status === "completed" && m.scorecard?.innings?.length,
  )
  if (!completed.length) return EMPTY

  let fours = 0
  let sixes = 0
  let fifties = 0
  let hundreds = 0
  let ducks = 0
  let maidens = 0
  let fiveWickets = 0
  let fourWickets = 0
  let catches = 0
  let runOuts = 0
  let wides = 0
  let noBalls = 0

  let highestRuns = -1
  let highestRunsBalls = 0
  let highestRunsNotOut = false

  let bestBowlWickets = -1
  let bestBowlRuns = 0

  let highestTeamRuns = -1
  let highestTeamWickets = 0
  let lowestTeamRuns = Number.POSITIVE_INFINITY
  let lowestTeamWickets = 0

  for (const m of completed) {
    const innings: Innings[] = m.scorecard?.innings ?? []
    for (const inn of innings) {
      // Team score (highest / lowest)
      if (inn.totalRuns > highestTeamRuns) {
        highestTeamRuns = inn.totalRuns
        highestTeamWickets = inn.totalWickets
      }
      if (inn.totalRuns < lowestTeamRuns) {
        lowestTeamRuns = inn.totalRuns
        lowestTeamWickets = inn.totalWickets
      }

      // Batting lines
      for (const b of inn.batting ?? []) {
        fours += b.fours ?? 0
        sixes += b.sixes ?? 0
        if (b.runs >= 100) hundreds++
        else if (b.runs >= 50) fifties++
        // Duck = 0 runs AND dismissed (not currently batting / not "not out").
        if (b.runs === 0 && isDismissed(b)) ducks++

        if (b.runs > highestRuns) {
          highestRuns = b.runs
          highestRunsBalls = b.balls ?? 0
          highestRunsNotOut = !isDismissed(b)
        }

        // Fielding dismissals from the batsman's dismissal string.
        const d = (b.dismissal ?? "").trim()
        if (isCaught(d)) catches++
        if (isRunOut(d)) runOuts++
      }

      // Bowling lines
      for (const bl of inn.bowling ?? []) {
        maidens += bl.maidens ?? 0
        wides += bl.wides ?? 0
        noBalls += bl.noballs ?? 0

        const wkts = bl.wickets ?? 0
        if (wkts >= 5) fiveWickets++
        else if (wkts === 4) fourWickets++

        // Best bowling = most wickets, tie-break fewest runs conceded.
        if (
          wkts > bestBowlWickets ||
          (wkts === bestBowlWickets && bl.runs < bestBowlRuns)
        ) {
          bestBowlWickets = wkts
          bestBowlRuns = bl.runs
        }
      }
    }
  }

  return {
    totalMatches: completed.length,
    fours,
    sixes,
    fifties,
    hundreds,
    ducks,
    maidens,
    fiveWickets,
    fourWickets,
    catches,
    runOuts,
    wides,
    noBalls,
    highestTeamScore:
      highestTeamRuns >= 0 ? `${highestTeamRuns}/${highestTeamWickets}` : "—",
    lowestTeamScore:
      lowestTeamRuns !== Number.POSITIVE_INFINITY
        ? `${lowestTeamRuns}/${lowestTeamWickets}`
        : "—",
    highestScore:
      highestRuns >= 0
        ? `${highestRuns}${highestRunsNotOut ? "*" : ""} (${highestRunsBalls})`
        : "—",
    bestBowling:
      bestBowlWickets > 0 ? `${bestBowlWickets}/${bestBowlRuns}` : "—",
  }
}

/** True if the batsman was out (dismissal recorded, not still batting). */
function isDismissed(b: BattingLine): boolean {
  if (b.isBatting) return false
  const d = (b.dismissal ?? "").trim().toLowerCase()
  if (!d) return false
  // "not out", "retired hurt" (without dismissal), "did not bat" → not a
  // completed dismissal that counts toward ducks.
  if (d === "not out" || d.startsWith("not out")) return false
  if (d.startsWith("retired")) return false
  if (d === "did not bat" || d.startsWith("did not bat")) return false
  return true
}

/**
 * CricClub-style dismissal strings:
 *   "c Jones b Smith"        → caught (by Jones)
 *   "c & b Smith"            → caught and bowled (still a catch)
 *   "run out (Sub)"          → not a catch
 *   "b Smith"                → bowled (not a catch)
 *   "lbw b Smith"            → lbw (not a catch)
 *   "st Jones b Smith"       → stumped (not a catch — counted separately)
 */
function isCaught(dismissal: string): boolean {
  const d = dismissal.trim().toLowerCase()
  if (!d) return false
  if (d.startsWith("run out")) return false
  // "c " prefix or "c & b " → caught.
  return d.startsWith("c ") || d.startsWith("c&b") || d.startsWith("c & b")
}

function isRunOut(dismissal: string): boolean {
  return dismissal.trim().toLowerCase().startsWith("run out")
}
