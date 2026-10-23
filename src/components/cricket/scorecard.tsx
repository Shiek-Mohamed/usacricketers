"use client"

import type { Innings, Scorecard } from "@/lib/types"
import { TeamBadgeByName } from "./ui"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"

function PlayerName({
  name,
  playerId,
  className,
}: {
  name: string
  playerId?: string
  className?: string
}) {
  const navigate = useAppStore((s) => s.navigate)
  if (playerId) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          navigate("player-detail", playerId)
        }}
        className={cn(className, "hover:underline hover:text-primary transition-colors")}
      >
        {name}
      </button>
    )
  }
  return <span className={className}>{name}</span>
}

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
      {/* Innings header — dark navy band */}
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

      {/* Batting — cricinfo-style stacked rows */}
      <BattingList innings={innings} />

      {/* Fall of wickets */}
      {innings.fallOfWickets.length > 0 && (
        <FallOfWickets fow={innings.fallOfWickets} />
      )}

      {/* Bowling — cricinfo-style stacked rows */}
      <BowlingList innings={innings} />
    </div>
  )
}

/* ---- Batting: cricinfo-style per-player rows ---- */

function BattingList({ innings }: { innings: Innings }) {
  const isExtras = (name: string) => name.toLowerCase() === "extras"
  const isTotal = (name: string) =>
    name.toLowerCase().startsWith("total") || name.toLowerCase() === "innings total"

  return (
    <div className="divide-y divide-border/40">
      {innings.batting.map((b, i) => {
        const extras = isExtras(b.name)
        const total = isTotal(b.name)
        const notOut = b.dismissal?.toLowerCase().includes("not out")

        return (
          <div
            key={i}
            className={cn(
              "flex items-start justify-between gap-3 px-4 py-2.5",
              extras && "bg-muted/20 italic",
              total && "bg-muted/30 font-bold"
            )}
          >
            {/* Left: name + dismissal */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {b.isBatting && !extras && !total && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 animate-pulse" />
                )}
                <PlayerName
                  name={b.name}
                  playerId={b.playerId}
                  className={cn(!extras && !total && "font-semibold text-sm")}
                />
              </div>
              {/* Dismissal text below name (cricinfo style) */}
              {!extras && !total && b.dismissal && (
                <div className="mt-0.5 pl-3 text-xs text-muted-foreground">
                  {b.dismissal}
                </div>
              )}
            </div>

            {/* Right: stats block (cricinfo style — runs big, details below) */}
            {!extras && !total ? (
              <div className="flex shrink-0 items-baseline gap-3">
                <span className="text-lg font-extrabold tabular-nums">{b.runs}</span>
                <span className="text-xs text-muted-foreground tabular-nums">({b.balls})</span>
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{b.fours}×4</span>
                  <span className="tabular-nums">{b.sixes}×6</span>
                  <span className="tabular-nums">SR {b.strikeRate > 0 ? b.strikeRate.toFixed(1) : "—"}</span>
                </div>
              </div>
            ) : (
              <div className="shrink-0 text-right">
                <span className="font-bold tabular-nums">{b.runs}</span>
                {total && (
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    ({innings.totalOvers} ov)
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
      {/* Auto-total row if not in data */}
      {!innings.batting.some(b => isTotal(b.name)) && (
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 font-bold">
          <span>Total</span>
          <span className="tabular-nums">
            {innings.totalRuns}/{innings.totalWickets}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({innings.totalOvers} ov)
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

/* ---- Fall of wickets (cricinfo-style) ---- */

function FallOfWickets({ fow }: { fow: string[] }) {
  return (
    <div className="border-t px-4 py-2.5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Fall of Wickets
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
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

/* ---- Bowling: cricinfo-style per-player rows ---- */

function BowlingList({ innings }: { innings: Innings }) {
  if (!innings.bowling?.length) return null
  return (
    <div className="divide-y divide-border/40 border-t">
      {innings.bowling.map((b, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start justify-between gap-3 px-4 py-2.5",
            i % 2 === 1 && "bg-muted/15"
          )}
        >
          {/* Left: bowler name */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {b.isBowling && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 animate-pulse" />
              )}
              <PlayerName
                name={b.name}
                playerId={b.playerId}
                className="font-semibold text-sm"
              />
            </div>
            <div className="mt-0.5 pl-3 text-xs text-muted-foreground tabular-nums">
              {b.overs} ov · {b.maidens} maidens
            </div>
          </div>

          {/* Right: key figures (cricinfo style) */}
          <div className="flex shrink-0 items-baseline gap-3">
            <div className="text-right">
              <span className="text-lg font-extrabold tabular-nums">{b.wickets}</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-sm font-semibold tabular-nums">{b.runs}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                Econ {b.economy > 0 ? b.economy.toFixed(2) : "—"}
              </span>
              {(b.wides > 0 || b.noballs > 0) && (
                <span className="tabular-nums">
                  {b.wides > 0 && `${b.wides}wd`}
                  {b.wides > 0 && b.noballs > 0 && " "}
                  {b.noballs > 0 && `${b.noballs}nb`}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
