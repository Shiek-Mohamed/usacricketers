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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { BarChart3 } from "lucide-react"

/** Ordinal suffix helper — 2 -> "2nd", 3 -> "3rd" (for repeat-innings labels). */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Fall-of-Wickets graph — a line chart showing the cumulative team score at
 * each wicket fallen, one line per innings. Lets a viewer compare how quickly
 * each side's top/middle order collapsed.
 *
 * Data source: `innings.fallOfWickets` (persisted as strings like
 * "217-3 (Smith, 35.2 ov)"). The leading "{score}-{wktNo}" pair is parsed out;
 * the batsman + over are kept for the tooltip. The live state's structured
 * `FallOfWicket[]` (with `score` / `wktNo` / `over` / `batsman`) is flattened
 * to the same string shape by `stateToScorecard`, so this chart works for both
 * live and completed matches.
 */
export function FallOfWicketsChart({
  match,
  scorecard,
}: {
  match: Match
  scorecard: Scorecard
}) {
  const t1Color = match.team1?.primaryColor ?? "#1e2a5e"
  const t2Color = match.team2?.primaryColor ?? "#94a3b8"

  /** Parse "217-3 (Smith, 35.2 ov)" → { wktNo, score, batsman, over }. */
  function parseFoW(s: string): {
    wktNo: number
    score: number
    batsman: string
    over: string
  } | null {
    const m = s.match(/^(\d+)\s*-\s*(\d+)/)
    if (!m) return null
    const batsmanMatch = s.match(/\(([^,]+),\s*([^)]+)\)/)
    return {
      score: Number(m[1]),
      wktNo: Number(m[2]),
      batsman: batsmanMatch ? batsmanMatch[1].trim() : "",
      over: batsmanMatch ? batsmanMatch[2].replace(/\sov$/, "").trim() : "",
    }
  }

  // One series per innings entry, keyed uniquely (inn-0, inn-1, …) so a team
  // that batted twice (Tests / follow-on) gets two independent lines instead
  // of both series colliding on the same teamId dataKey. Repeat innings of
  // the same team are disambiguated in the legend via an occurrence suffix.
  const series = scorecard.innings
    .map((inn, i) => {
      const color = inn.teamId === match.team1Id ? t1Color : t2Color
      const points = inn.fallOfWickets
        .map(parseFoW)
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => a.wktNo - b.wktNo)
      const occurrence =
        scorecard.innings.slice(0, i + 1).filter((x) => x.teamId === inn.teamId)
          .length
      return {
        key: `inn-${i}`,
        shortName: inn.teamShortName,
        label:
          occurrence > 1
            ? `${inn.teamShortName} (${ordinal(occurrence)} inns)`
            : inn.teamShortName,
        color,
        points,
      }
    })
    .filter((s) => s.points.length > 0)

  if (series.length === 0) {
    return (
      <Card className="overflow-hidden p-0">
        <div className="border-b bg-muted/30 px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            Fall of Wickets
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">No wickets yet</p>
          <p className="text-xs text-muted-foreground/70">
            The fall-of-wickets chart appears here once the first wicket falls.
          </p>
        </div>
      </Card>
    )
  }

  // Build a merged dataset keyed by wicket number (1..maxWkt). Each row has
  // the score at that wicket for each innings (null when that innings hadn't
  // lost that wicket — e.g. only 4 wickets fell but the chart goes to 10).
  const maxWickets = Math.max(
    ...series.flatMap((s) => s.points.map((p) => p.wktNo)),
    1,
  )
  const allWickets = Array.from({ length: maxWickets }, (_, i) => i + 1)

  const data = allWickets.map((wkt) => {
    const row: Record<string, number | string | null> = { wicket: `Wkt ${wkt}` }
    for (const s of series) {
      const pt = s.points.find((p) => p.wktNo === wkt)
      row[s.key] = pt ? pt.score : null
    }
    return row
  })

  const chartConfig: ChartConfig = {}
  for (const s of series) {
    chartConfig[s.key] = { label: s.label, color: s.color }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide">
          <BarChart3 className="h-4 w-4 text-emerald-600" />
          Fall of Wickets
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cumulative score at each wicket — {series.map((s) => s.shortName).join(" vs ")}
        </p>
      </div>
      <div className="p-4">
        {/* Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-4">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="h-3 w-6 rounded-full" style={{ background: s.color }} />
              <span className="text-sm font-bold">{s.label}</span>
            </div>
          ))}
        </div>
        <ChartContainer
          config={chartConfig}
          className="h-[240px] w-full sm:h-[300px]"
        >
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="wicket"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              label={{
                value: "Wicket",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 11, fill: "#9ca3af" },
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              label={{
                value: "Score",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#9ca3af" },
              }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: s.color }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ChartContainer>
      </div>
    </Card>
  )
}
