"use client"

import type { Scorecard, Match } from "@/lib/types"
import { Card } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts"
import { BarChart3 } from "lucide-react"

/** Commentary entry subset — works for both the live `CommentaryEntry` and
 *  the persisted `{ id, over, text, kind }` scorecard shape (both have these
 *  three fields). */
interface CEntry {
  over: string
  text: string
  kind: string
}

/** Kinds that represent actual deliveries (used to filter commentary). */
const BALL_KINDS = new Set(["run", "boundary", "six", "wicket", "extra", "dot"])

/** Runs contributed by a single commentary ball entry. Mirrors the helper in
 *  live-match-enhancements.tsx so the over totals match the worm charts. */
function runsFromBall(entry: CEntry): number {
  switch (entry.kind) {
    case "boundary":
      return 4
    case "six":
      return 6
    case "wicket":
      return 0
    case "dot":
      return 0
    case "run": {
      const m = entry.text.match(/^(\d+)/)
      return m ? Number(m[1]) : 0
    }
    case "extra": {
      const plus = entry.text.match(/\(\+(\d+)\)/)
      if (plus) return Number(plus[1])
      const m = entry.text.match(/(\d+)/)
      return m ? Number(m[1]) : 1
    }
    default:
      return 0
  }
}

/**
 * Split a commentary feed (newest-first) into per-innings chunks, ordered to
 * match `scorecard.innings[i]`. Commentary doesn't carry a teamId/innings
 * index, so we walk it chronologically (reversed) and start a new chunk
 * whenever an `info` entry marks an innings end ("Innings end — …"). The
 * first "innings begins" marker (added by `initState` for innings 1) and any
 * super-over announcement stay inside their chunk. Falls back to a single
 * chunk when no boundary markers exist (e.g. imported completed matches or
 * an in-progress first innings).
 */
function splitCommentaryByInnings<T extends CEntry>(commentary: T[]): T[][] {
  const chrono = [...commentary].reverse()
  const chunks: T[][] = [[]]
  for (const entry of chrono) {
    if (entry.kind === "info" && /^Innings end/i.test(entry.text)) {
      // The end marker belongs to the innings that just finished; close the
      // current chunk with it, then open a fresh chunk for the next innings.
      chunks[chunks.length - 1].push(entry)
      chunks.push([])
    } else {
      chunks[chunks.length - 1].push(entry)
    }
  }
  // Drop a trailing empty chunk (left by the final "Innings end").
  while (chunks.length > 0 && chunks[chunks.length - 1].length === 0) {
    chunks.pop()
  }
  return chunks
}

/**
 * Over-comparison chart — a grouped bar chart of runs conceded per over, one
 * series per team (so the two innings' over-by-over run rates are visually
 * comparable side by side). Team-colored bars.
 *
 * Runs-per-over is computed from the ball-by-ball commentary, attributing
 * each ball to its innings via the innings-boundary markers (see
 * `splitCommentaryByInnings`). In Test matches with multiple innings per
 * team, each team's innings are aggregated into a single per-over series.
 */
export function OverComparisonChart({
  match,
  scorecard,
}: {
  match: Match
  scorecard: Scorecard
}) {
  const t1Color = match.team1?.primaryColor ?? "#1e2a5e"
  const t2Color = match.team2?.primaryColor ?? "#94a3b8"

  const chunks = splitCommentaryByInnings(scorecard.commentary ?? [])

  // Map each innings (by battingTeamId) to a per-over runs map, aggregated
  // across all of that team's innings (limited-overs = 1 innings each).
  // chunks align positionally with scorecard.innings — each completed
  // innings pushes exactly one chunk (terminated by an "Innings end" marker),
  // and an in-progress innings is the final chunk with no end marker yet.
  // Super-over innings are skipped — their single over would otherwise be
  // summed into the team's over-1 bar and distort the comparison.
  const teamOverRuns = new Map<string, Map<number, number>>()
  scorecard.innings.forEach((inn, i) => {
    if (inn.isSuperOver) return
    const chunk = chunks[i] ?? []
    const overRuns = teamOverRuns.get(inn.teamId) ?? new Map<number, number>()
    for (const c of chunk) {
      if (!BALL_KINDS.has(c.kind)) continue
      const overNum = parseInt(c.over?.split(".")[0] || "0", 10)
      if (overNum < 1) continue
      overRuns.set(overNum, (overRuns.get(overNum) ?? 0) + runsFromBall(c))
    }
    teamOverRuns.set(inn.teamId, overRuns)
  })

  const t1OverRuns = teamOverRuns.get(match.team1Id) ?? new Map<number, number>()
  const t2OverRuns = teamOverRuns.get(match.team2Id) ?? new Map<number, number>()

  const maxOver = Math.max(
    ...Array.from(t1OverRuns.keys()),
    ...Array.from(t2OverRuns.keys()),
    0,
  )
  if (maxOver === 0) {
    return (
      <Card className="overflow-hidden p-0">
        <div className="border-b bg-muted/30 px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            Over Comparison
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">No over data yet</p>
          <p className="text-xs text-muted-foreground/70">
            Runs-per-over bars appear here as overs are completed.
          </p>
        </div>
      </Card>
    )
  }

  const data = Array.from({ length: maxOver }, (_, i) => i + 1).map((ov) => ({
    over: `${ov}`,
    [match.team1Id]: t1OverRuns.has(ov) ? t1OverRuns.get(ov)! : null,
    [match.team2Id]: t2OverRuns.has(ov) ? t2OverRuns.get(ov)! : null,
  }))

  const chartConfig: ChartConfig = {
    [match.team1Id]: { label: match.team1?.shortName ?? "Team 1", color: t1Color },
    [match.team2Id]: { label: match.team2?.shortName ?? "Team 2", color: t2Color },
  }

  // Y-axis domain — round up to the nearest 2 for tidy ticks.
  const maxRuns = Math.max(
    ...data.flatMap((d) => [
      d[match.team1Id] as number | null,
      d[match.team2Id] as number | null,
    ]).filter((v): v is number => v !== null),
    6,
  )
  const yMax = Math.ceil(maxRuns / 2) * 2

  const hasT1 = t1OverRuns.size > 0
  const hasT2 = t2OverRuns.size > 0

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
          <BarChart3 className="h-4 w-4 text-emerald-600" />
          Over Comparison
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Runs per over — {match.team1?.shortName ?? "Team 1"} vs {match.team2?.shortName ?? "Team 2"}
        </p>
      </div>
      <div className="p-4">
        {/* Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-4">
          {hasT1 && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-6 rounded-full" style={{ background: t1Color }} />
              <span className="text-sm font-bold">{match.team1?.shortName}</span>
            </div>
          )}
          {hasT2 && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-6 rounded-full" style={{ background: t2Color }} />
              <span className="text-sm font-bold">{match.team2?.shortName}</span>
            </div>
          )}
        </div>
        <ChartContainer
          config={chartConfig}
          className="h-[240px] w-full sm:h-[300px]"
        >
          <BarChart
            data={data}
            margin={{ top: 16, right: 12, bottom: 8, left: -12 }}
            barCategoryGap="20%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="over"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              label={{
                value: "Over",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 11, fill: "#9ca3af" },
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              domain={[0, yMax]}
              width={32}
              label={{
                value: "Runs",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#9ca3af" },
              }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {hasT1 && (
              <Bar
                dataKey={match.team1Id}
                fill={t1Color}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
              />
            )}
            {hasT2 && (
              <Bar
                dataKey={match.team2Id}
                fill={t2Color}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
              />
            )}
          </BarChart>
        </ChartContainer>
      </div>
    </Card>
  )
}
