"use client"

import type { Innings, Scorecard } from "@/lib/types"
import { TeamBadgeByName } from "./ui"
import { cn } from "@/lib/utils"

export function ScorecardView({ scorecard }: { scorecard: Scorecard }) {
  if (!scorecard.innings?.length) {
    return <p className="text-muted-foreground">Scorecard not yet available.</p>
  }
  return (
    <div className="space-y-6">
      {scorecard.note && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {scorecard.note}
        </div>
      )}
      {scorecard.innings.map((inn, i) => (
        <InningsCard key={i} innings={inn} />
      ))}
    </div>
  )
}

function InningsCard({ innings }: { innings: Innings }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <TeamBadgeByName shortName={innings.teamShortName} size="sm" />
          <span className="font-bold text-sm">{innings.teamShortName}</span>
        </div>
        <span className="font-extrabold text-base tabular-nums">
          {innings.total}
          {innings.declared && " (d)"}
          <span className="text-muted-foreground font-normal text-xs ml-1">
            ({innings.totalOvers} ov)
          </span>
        </span>
      </div>
      <BattingTable innings={innings} />
      <BowlingTable innings={innings} />
      {innings.fallOfWickets.length > 0 && (
        <div className="border-t px-3 py-2 text-xs">
          <div className="font-semibold text-muted-foreground mb-1">
            Fall of Wickets
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {innings.fallOfWickets.map((fow, i) => (
              <span key={i} className="tabular-nums">
                {fow}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BattingTable({ innings }: { innings: Innings }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
            <th className="py-1.5 px-3 font-semibold">Batter</th>
            <th className="py-1.5 px-2 font-semibold text-right">R</th>
            <th className="py-1.5 px-2 font-semibold text-right">B</th>
            <th className="py-1.5 px-2 font-semibold text-right hidden sm:table-cell">4s</th>
            <th className="py-1.5 px-2 font-semibold text-right hidden sm:table-cell">6s</th>
            <th className="py-1.5 px-2 font-semibold text-right">SR</th>
            <th className="py-1.5 px-3 font-semibold text-left hidden md:table-cell">
              Dismissal
            </th>
          </tr>
        </thead>
        <tbody>
          {innings.batting.map((b, i) => (
            <tr
              key={i}
              className={cn(
                "border-b border-border/50",
                b.name === "Extras" && "bg-muted/30 italic"
              )}
            >
              <td className="py-1.5 px-3">
                <div className="flex items-center gap-1.5">
                  {b.isBatting && b.name !== "Extras" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  )}
                  <span className={cn(b.name === "Extras" ? "text-muted-foreground" : "font-medium")}>
                    {b.name}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground md:hidden">
                  {b.dismissal}
                </div>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                {b.runs}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                {b.balls}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums hidden sm:table-cell">
                {b.fours}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums hidden sm:table-cell">
                {b.sixes}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                {b.strikeRate.toFixed(1)}
              </td>
              <td className="py-1.5 px-3 text-left text-xs text-muted-foreground hidden md:table-cell">
                {b.dismissal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BowlingTable({ innings }: { innings: Innings }) {
  if (!innings.bowling?.length) return null
  return (
    <div className="border-t overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
            <th className="py-1.5 px-3 font-semibold">Bowler</th>
            <th className="py-1.5 px-2 font-semibold text-right">O</th>
            <th className="py-1.5 px-2 font-semibold text-right hidden sm:table-cell">M</th>
            <th className="py-1.5 px-2 font-semibold text-right">R</th>
            <th className="py-1.5 px-2 font-semibold text-right">W</th>
            <th className="py-1.5 px-2 font-semibold text-right">Econ</th>
          </tr>
        </thead>
        <tbody>
          {innings.bowling.map((b, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-1.5 px-3">
                <div className="flex items-center gap-1.5">
                  {b.isBowling && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  )}
                  <span className="font-medium">{b.name}</span>
                </div>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                {b.overs}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {b.maidens}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">{b.runs}</td>
              <td className="py-1.5 px-2 text-right tabular-nums font-bold">
                {b.wickets}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                {b.economy.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
