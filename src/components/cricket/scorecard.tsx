"use client"

import type { Innings, Scorecard } from "@/lib/types"
import { TeamBadgeByName } from "./ui"
import { cn } from "@/lib/utils"

export function ScorecardView({ scorecard }: { scorecard: Scorecard }) {
  if (!scorecard.innings?.length) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Scorecard not yet available.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {scorecard.note && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {scorecard.note}
        </div>
      )}
      {scorecard.innings.map((inn, i) => (
        <InningsCard key={i} innings={inn} inningsNo={i + 1} />
      ))}
    </div>
  )
}

/* ---- Cricinfo-style innings card ---- */

function InningsCard({
  innings,
  inningsNo,
}: {
  innings: Innings
  inningsNo: number
}) {
  const ordinal = inningsNo === 1 ? "1st" : inningsNo === 2 ? "2nd" : `${inningsNo}th`
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Innings header — dark navy band (cricinfo style) */}
      <div className="flex items-center justify-between bg-[#1e2a5e] px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <TeamBadgeByName shortName={innings.teamShortName} size="sm" />
          <span className="text-sm font-bold uppercase tracking-wide">
            {innings.teamShortName}
          </span>
          <span className="text-xs text-white/60">{ordinal} innings</span>
        </div>
        <span className="text-lg font-extrabold tabular-nums">
          {innings.totalRuns}/{innings.totalWickets}
          {innings.declared && "d"}
          <span className="ml-1.5 text-xs font-normal text-white/60">
            ({innings.totalOvers} ov)
          </span>
        </span>
      </div>

      {/* Batting table */}
      <BattingTable innings={innings} />

      {/* Fall of wickets */}
      {innings.fallOfWickets.length > 0 && (
        <FallOfWickets fow={innings.fallOfWickets} />
      )}

      {/* Bowling table */}
      <BowlingTable innings={innings} />
    </div>
  )
}

/* ---- Batting table (cricinfo-style) ---- */

function BattingTable({ innings }: { innings: Innings }) {
  const isExtras = (name: string) => name.toLowerCase() === "extras"
  const isTotal = (name: string) =>
    name.toLowerCase().startsWith("total") || name.toLowerCase() === "innings total"

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4 pr-2 text-left font-semibold">Batter</th>
            <th className="py-2 px-2 text-right font-semibold">Dismissal</th>
            <th className="py-2 px-2 text-right font-semibold">R</th>
            <th className="py-2 px-2 text-right font-semibold">B</th>
            <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">4s</th>
            <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">6s</th>
            <th className="py-2 pl-2 pr-4 text-right font-semibold">SR</th>
          </tr>
        </thead>
        <tbody>
          {innings.batting.map((b, i) => {
            const extras = isExtras(b.name)
            const total = isTotal(b.name)
            return (
              <tr
                key={i}
                className={cn(
                  "border-b border-border/40",
                  (i % 2 === 1 && !extras && !total) && "bg-muted/15",
                  extras && "bg-muted/20 italic text-muted-foreground",
                  total && "bg-muted/30 font-bold"
                )}
              >
                <td className="py-2 pl-4 pr-2">
                  <div className="flex items-center gap-1.5">
                    {b.isBatting && !extras && !total && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 animate-pulse" />
                    )}
                    <span className={cn(!extras && !total && "font-medium")}>
                      {b.name}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-left text-xs text-muted-foreground">
                  {b.dismissal || "—"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums font-semibold">
                  {b.runs}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                  {b.balls}
                </td>
                <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">
                  {b.fours}
                </td>
                <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">
                  {b.sixes}
                </td>
                <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground">
                  {b.strikeRate > 0 ? b.strikeRate.toFixed(1) : "—"}
                </td>
              </tr>
            )
          })}
          {/* If no explicit Total row exists in the data, add one */}
          {!innings.batting.some(b => isTotal(b.name)) && (
            <tr className="border-b bg-muted/30 font-bold">
              <td className="py-2 pl-4 pr-2">Total</td>
              <td className="py-2 px-2 text-left text-xs text-muted-foreground">
                ({innings.totalOvers} ov)
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {innings.totalRuns}/{innings.totalWickets}
              </td>
              <td colSpan={4} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ---- Fall of wickets (cricinfo-style horizontal flow) ---- */

function FallOfWickets({ fow }: { fow: string[] }) {
  return (
    <div className="border-t px-4 py-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Fall of Wickets
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        {fow.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/40">•</span>}
            <span className="tabular-nums text-muted-foreground">{w}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---- Bowling table (cricinfo-style) ---- */

function BowlingTable({ innings }: { innings: Innings }) {
  if (!innings.bowling?.length) return null
  return (
    <div className="border-t overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4 pr-2 text-left font-semibold">Bowler</th>
            <th className="py-2 px-2 text-right font-semibold">O</th>
            <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">M</th>
            <th className="py-2 px-2 text-right font-semibold">R</th>
            <th className="py-2 px-2 text-right font-semibold">W</th>
            <th className="py-2 px-2 text-right font-semibold">Econ</th>
            <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">WD</th>
            <th className="py-2 pl-2 pr-4 text-right font-semibold hidden sm:table-cell">NB</th>
          </tr>
        </thead>
        <tbody>
          {innings.bowling.map((b, i) => (
            <tr
              key={i}
              className={cn(
                "border-b border-border/40",
                i % 2 === 1 && "bg-muted/15"
              )}
            >
              <td className="py-2 pl-4 pr-2">
                <div className="flex items-center gap-1.5">
                  {b.isBowling && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 animate-pulse" />
                  )}
                  <span className="font-medium">{b.name}</span>
                </div>
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{b.overs}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {b.maidens}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{b.runs}</td>
              <td className="py-2 px-2 text-right tabular-nums font-bold">
                {b.wickets}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                {b.economy > 0 ? b.economy.toFixed(2) : "—"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {b.wides || 0}
              </td>
              <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {b.noballs || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
