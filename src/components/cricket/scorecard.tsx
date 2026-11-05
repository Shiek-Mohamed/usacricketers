"use client"

import type { Innings, Scorecard, BattingLine, BowlingLine } from "@/lib/types"
import { TeamBadgeByName } from "./ui"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Public entry                                                               */
/* -------------------------------------------------------------------------- */

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
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200">
          {scorecard.note}
        </div>
      )}
      {scorecard.innings.map((inn, i) => (
        <InningsCard key={i} innings={inn} inningsNo={i + 1} />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Innings card                                                              */
/* -------------------------------------------------------------------------- */

function InningsCard({
  innings,
  inningsNo,
}: {
  innings: Innings
  inningsNo: number
}) {
  const ordinal =
    inningsNo === 1 ? "1st" : inningsNo === 2 ? "2nd" : `${inningsNo}th`
  const runRate = computeRunRate(innings)

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Innings header — dark navy band (Cricinfo style) */}
      <div className="flex items-center justify-between bg-[#1e2a5e] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <TeamBadgeByName shortName={innings.teamShortName} size="sm" />
          <span className="font-barlow text-sm font-bold uppercase tracking-wide">
            {innings.teamShortName}
          </span>
          <span className="font-barlow text-xs font-medium uppercase tracking-wide text-white/60">{ordinal} innings</span>
        </div>
        <span className="font-barlow text-2xl font-black leading-none tabular-nums tracking-tight sm:text-3xl">
          {innings.totalRuns}<span className="text-white/60">/{innings.totalWickets}</span>
          {innings.declared && <span className="text-sm font-bold">d</span>}
          <span className="ml-2 font-barlow text-xs font-medium normal-case text-white/60">
            ({innings.totalOvers} ov{runRate !== null && ` · RR ${runRate}`})
          </span>
        </span>
      </div>

      {/* Batting */}
      <BattingBlock innings={innings} />

      {/* Fall of wickets */}
      {innings.fallOfWickets.length > 0 && (
        <FallOfWickets fow={innings.fallOfWickets} />
      )}

      {/* Partnerships */}
      {innings.partnerships && innings.partnerships.length > 0 && (
        <Partnerships partnerships={innings.partnerships} />
      )}

      {/* Bowling */}
      <BowlingBlock innings={innings} />
    </div>
  )
}

function computeRunRate(inn: Innings): string | null {
  const overs = parseFloat(inn.totalOvers)
  if (!Number.isFinite(overs) || overs <= 0) return null
  // totalOvers like "42.4" → 42.4 (already decimal overs, not balls)
  return (inn.totalRuns / overs).toFixed(2)
}

/* -------------------------------------------------------------------------- */
/*  Player name (links to player profile if id present)                        */
/* -------------------------------------------------------------------------- */

function PlayerName({
  name,
  playerId,
  className,
  isCaptain,
  isKeeper,
}: {
  name: string
  playerId?: string
  className?: string
  isCaptain?: boolean
  isKeeper?: boolean
}) {
  const decorated = (
    <>
      {name}
      {isKeeper && <span className="ml-0.5 text-muted-foreground">†</span>}
      {isCaptain && <span className="ml-0.5 text-muted-foreground">(c)</span>}
    </>
  )
  // Render as a real `<a href="/players/${id}">` so the link deep-links to the
  // SSR player profile (full page navigation — what we want for SEO +
  // shareability). The SPA `?view=player-detail&id=xxx` flow still works for
  // legacy links. `stopPropagation` keeps the click from bubbling up into any
  // row-hover handlers in the batting/bowling tables.
  if (playerId) {
    return (
      <a
        href={`/players/${playerId}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          className,
          "hover:underline hover:text-primary transition-colors text-left"
        )}
      >
        {decorated}
      </a>
    )
  }
  return <span className={className}>{decorated}</span>
}

/* -------------------------------------------------------------------------- */
/*  BATTING BLOCK                                                              */
/* -------------------------------------------------------------------------- */

function isExtrasRow(name: string) {
  return name.toLowerCase() === "extras"
}
function isTotalRow(name: string) {
  const n = name.toLowerCase()
  return n.startsWith("total") || n === "innings total"
}

function BattingBlock({ innings }: { innings: Innings }) {
  // Split batting rows into: real batsmen, extras, total
  const batsmen = innings.batting.filter(
    (b) => !isExtrasRow(b.name) && !isTotalRow(b.name)
  )
  const extrasRow = innings.batting.find((b) => isExtrasRow(b.name))
  const totalRow = innings.batting.find((b) => isTotalRow(b.name))
  const hasExplicitTotal = Boolean(totalRow)

  return (
    <div className="border-b border-border/60">
      {/* Desktop: proper Cricinfo-style table with column headers */}
      <div className="hidden md:block">
        <BattingTable
          batsmen={batsmen}
          extrasRow={extrasRow}
          totalRow={totalRow}
          hasExplicitTotal={hasExplicitTotal}
          innings={innings}
        />
      </div>

      {/* Mobile: stacked rows */}
      <div className="md:hidden divide-y divide-border/40">
        {innings.batting.map((b, i) => (
          <BattingStackedRow key={i} b={b} innings={innings} />
        ))}
        {!hasExplicitTotal && <BattingStackedTotalRow innings={innings} />}
        {innings.didNotBat && innings.didNotBat.length > 0 && (
          <DidNotBat didNotBat={innings.didNotBat} />
        )}
      </div>
    </div>
  )
}

/* -------------------- Desktop batting table -------------------- */

function BattingTable({
  batsmen,
  extrasRow,
  totalRow,
  hasExplicitTotal,
  innings,
}: {
  batsmen: BattingLine[]
  extrasRow?: BattingLine
  totalRow?: BattingLine
  hasExplicitTotal: boolean
  innings: Innings
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-[#1e2a5e] text-white">
          <th className="px-4 py-2.5 text-left font-barlow text-[11px] font-bold uppercase tracking-widest">Batsman</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">R</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">B</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">4s</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">6s</th>
          <th className="px-4 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">SR</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {batsmen.map((b, i) => (
          <BattingTableRow key={i} b={b} index={i} />
        ))}
        {extrasRow && <BattingExtrasRow row={extrasRow} innings={innings} />}
        <BattingTotalRow
          row={totalRow}
          innings={innings}
          hasExplicitTotal={hasExplicitTotal}
        />
      </tbody>
    </table>
  )
}

function BattingTableRow({ b, index }: { b: BattingLine; index?: number }) {
  return (
    <tr className={cn("hover:bg-muted/30 transition-colors", index !== undefined && index % 2 === 1 && "bg-muted/15")}>
      <td className="px-4 py-2.5 align-top">
        {/* Name + dismissal on the SAME line — the dismissal (e.g.
            "c Maxwell b Zampa") sits inline after the name in a lighter,
            italic style. Truncates if the column is too narrow. */}
        <div className="flex items-baseline gap-x-2 min-w-0">
          {b.isBatting && (
            <span className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-red-600 animate-pulse" />
          )}
          <PlayerName
            name={b.name}
            playerId={b.playerId}
            isCaptain={b.isCaptain}
            isKeeper={b.isKeeper}
            className="font-barlow font-semibold tracking-tight whitespace-nowrap"
          />
          {b.dismissal && (
            <span className="text-xs italic text-muted-foreground truncate">
              {b.dismissal}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow text-base font-extrabold tabular-nums tracking-tight">
        {b.runs}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow tabular-nums text-muted-foreground">
        {b.balls}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow tabular-nums text-muted-foreground">
        {b.fours}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow tabular-nums text-muted-foreground">
        {b.sixes}
      </td>
      <td className="px-4 py-2.5 text-right align-top font-barlow tabular-nums text-muted-foreground">
        {b.strikeRate > 0 ? b.strikeRate.toFixed(1) : "—"}
      </td>
    </tr>
  )
}

function BattingExtrasRow({
  row,
  innings,
}: {
  row: BattingLine
  innings: Innings
}) {
  // Build the (b 2, lb 4, w 6, nb 2) breakdown string from innings.extrasBreakdown
  // (preferred) — fall back to the row.dismissal field which may already contain it.
  const bd = innings.extrasBreakdown
  const parts: string[] = []
  if (bd) {
    if (bd.byes) parts.push(`b ${bd.byes}`)
    if (bd.legByes) parts.push(`lb ${bd.legByes}`)
    if (bd.wides) parts.push(`w ${bd.wides}`)
    if (bd.noBalls) parts.push(`nb ${bd.noBalls}`)
  }
  const breakdown = parts.length > 0 ? parts.join(", ") : null

  return (
    <tr className="bg-muted/15 italic">
      <td className="px-4 py-2.5 align-top">
        <div className="font-medium">Extras</div>
        {breakdown && (
          <div className="mt-0.5 text-xs not-italic text-muted-foreground">
            ({breakdown})
          </div>
        )}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-bold tabular-nums">
        {row.runs}
      </td>
      <td className="px-2 py-2.5" />
      <td className="px-2 py-2.5" />
      <td className="px-2 py-2.5" />
      <td className="px-4 py-2.5" />
    </tr>
  )
}

function BattingTotalRow({
  row,
  innings,
  hasExplicitTotal,
}: {
  row?: BattingLine
  innings: Innings
  hasExplicitTotal: boolean
}) {
  const runRate = computeRunRate(innings)
  const label = row?.name ?? "Total"
  return (
    <tr className="bg-[#1e2a5e]/5 font-bold border-t-2 border-border/40">
      <td className="px-4 py-2.5 align-top">
        <div className="font-barlow font-bold tracking-tight">{label}</div>
        {runRate && (
          <div className="mt-0.5 font-barlow text-xs font-normal text-muted-foreground">
            RR {runRate}
          </div>
        )}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow text-base font-black tabular-nums tracking-tight">
        {innings.totalRuns}<span className="text-muted-foreground">/{innings.totalWickets}</span>
        {innings.declared && <span className="text-sm">d</span>}
      </td>
      <td className="px-2 py-2.5" />
      <td className="px-2 py-2.5" />
      <td className="px-2 py-2.5" />
      <td className="px-4 py-2.5 text-right align-top text-xs font-normal text-muted-foreground tabular-nums">
        ({innings.totalOvers} ov)
      </td>
    </tr>
  )
}

/* -------------------- Mobile batting stacked rows -------------------- */

function BattingStackedRow({ b, innings }: { b: BattingLine; innings: Innings }) {
  const extras = isExtrasRow(b.name)
  const total = isTotalRow(b.name)
  const notOut = b.dismissal?.toLowerCase().includes("not out")

  return (
    <div
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
            isCaptain={b.isCaptain}
            isKeeper={b.isKeeper}
            className={cn(!extras && !total && "font-semibold text-sm")}
          />
        </div>
        {!extras && !total && b.dismissal && (
          <div className="mt-0.5 pl-3 text-xs italic text-muted-foreground">
            {b.dismissal}
          </div>
        )}
        {extras && innings.extrasBreakdown && (
          <div className="mt-0.5 text-xs not-italic text-muted-foreground">
            ({buildExtrasBreakdownString(innings.extrasBreakdown)})
          </div>
        )}
      </div>

      {/* Right: stats */}
      {!extras && !total ? (
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="text-lg font-extrabold tabular-nums">{b.runs}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            ({b.balls})
          </span>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{b.fours}×4</span>
            <span className="tabular-nums">{b.sixes}×6</span>
            <span className="tabular-nums">
              SR {b.strikeRate > 0 ? b.strikeRate.toFixed(1) : "—"}
            </span>
          </div>
        </div>
      ) : (
        <div className="shrink-0 text-right">
          <span className="font-bold tabular-nums">{b.runs}</span>
          {total && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
              ({innings.totalOvers} ov, RR {(() => {
                const overs = parseFloat(innings.totalOvers) || 0
                return overs > 0 ? (innings.totalRuns / overs).toFixed(2) : "0.00"
              })()})
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function BattingStackedTotalRow({ innings }: { innings: Innings }) {
  const runRate = computeRunRate(innings)
  return (
    <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 font-bold">
      <span>Total</span>
      <span className="tabular-nums">
        {innings.totalRuns}/{innings.totalWickets}
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          ({innings.totalOvers} ov{runRate && `, RR ${runRate}`})
        </span>
      </span>
    </div>
  )
}

function buildExtrasBreakdownString(bd: NonNullable<Innings["extrasBreakdown"]>) {
  const parts: string[] = []
  if (bd.byes) parts.push(`b ${bd.byes}`)
  if (bd.legByes) parts.push(`lb ${bd.legByes}`)
  if (bd.wides) parts.push(`w ${bd.wides}`)
  if (bd.noBalls) parts.push(`nb ${bd.noBalls}`)
  return parts.join(", ")
}

/* -------------------- Did not bat (shared mobile + desktop) -------------------- */

function DidNotBat({
  didNotBat,
}: {
  didNotBat: NonNullable<Innings["didNotBat"]>
}) {
  return (
    <div className="px-4 py-2.5 text-sm">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Did not bat:{" "}
      </span>
      <span className="text-muted-foreground">
        {didNotBat.map((p, i) => (
          <span key={i}>
            {i > 0 && ", "}
            {p.name}
            {p.isKeeper && " †"}
            {p.isCaptain && " (c)"}
          </span>
        ))}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  FALL OF WICKETS                                                            */
/* -------------------------------------------------------------------------- */

function FallOfWickets({ fow }: { fow: string[] }) {
  return (
    <div className="border-b border-border/60 px-4 py-2.5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Fall of Wickets
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {fow.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground/40">,</span>}
            <span className="tabular-nums text-muted-foreground">{w}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---- Partnerships (Cricinfo-style: each wicket partnership) ---- */

function Partnerships({ partnerships }: { partnerships: string[] }) {
  return (
    <div className="border-b border-border/60 px-4 py-2.5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Partnerships
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {partnerships.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground/40">,</span>}
            <span className="tabular-nums text-muted-foreground">{p}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  BOWLING BLOCK                                                              */
/* -------------------------------------------------------------------------- */

function BowlingBlock({ innings }: { innings: Innings }) {
  if (!innings.bowling?.length) return null
  return (
    <>
      {/* Desktop: proper table */}
      <div className="hidden md:block">
        <BowlingTable bowling={innings.bowling} />
      </div>
      {/* Mobile: stacked rows */}
      <div className="md:hidden divide-y divide-border/40 border-t">
        {innings.bowling.map((b, i) => (
          <BowlingStackedRow key={i} b={b} zebra={i % 2 === 1} />
        ))}
      </div>
    </>
  )
}

function BowlingTable({ bowling }: { bowling: BowlingLine[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-[#1e2a5e] text-white">
          <th className="px-4 py-2.5 text-left font-barlow text-[11px] font-bold uppercase tracking-widest">Bowler</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">O</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">M</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">R</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">W</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">Econ</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">0s</th>
          <th className="px-2 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">4s</th>
          <th className="px-4 py-2.5 text-right font-barlow text-[11px] font-bold uppercase tracking-widest tabular-nums">6s</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {bowling.map((b, i) => (
          <BowlingTableRow key={i} b={b} zebra={i % 2 === 1} />
        ))}
      </tbody>
    </table>
  )
}

function BowlingTableRow({ b, zebra }: { b: BowlingLine; zebra: boolean }) {
  return (
    <tr className={cn("hover:bg-muted/30 transition-colors", zebra && "bg-muted/15")}>
      <td className="px-4 py-2.5 align-top">
        <div className="flex items-center gap-1.5">
          {b.isBowling && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 animate-pulse" />
          )}
          <PlayerName name={b.name} playerId={b.playerId} className="font-barlow font-semibold tracking-tight" />
        </div>
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow tabular-nums">{b.overs}</td>
      <td className="px-2 py-2.5 text-right align-top font-barlow tabular-nums text-muted-foreground">
        {b.maidens}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow tabular-nums">
        {b.runs}
      </td>
      <td className="px-2 py-2.5 text-right align-top font-barlow text-base font-extrabold tabular-nums tracking-tight">
        {b.wickets}
      </td>
      <td className="px-2 py-2.5 text-right align-top tabular-nums text-muted-foreground">
        {b.economy > 0 ? b.economy.toFixed(2) : "—"}
      </td>
      <td className="px-2 py-2.5 text-right align-top tabular-nums text-muted-foreground">
        {b.dots ?? 0}
      </td>
      <td className="px-2 py-2.5 text-right align-top tabular-nums text-muted-foreground">
        {b.foursConceded ?? 0}
      </td>
      <td className="px-4 py-2.5 text-right align-top tabular-nums text-muted-foreground">
        {b.sixesConceded ?? 0}
      </td>
    </tr>
  )
}

function BowlingStackedRow({ b, zebra }: { b: BowlingLine; zebra: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-4 py-2.5",
        zebra && "bg-muted/15"
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

      {/* Right: key figures */}
      <div className="flex shrink-0 items-baseline gap-3">
        <div className="text-right">
          <span className="text-lg font-extrabold tabular-nums">{b.wickets}</span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-sm font-semibold tabular-nums">{b.runs}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            Econ {b.economy > 0 ? b.economy.toFixed(2) : "—"}
          </span>
          {b.dots !== undefined && b.dots > 0 && (
            <span className="tabular-nums">{b.dots} 0s</span>
          )}
          {b.foursConceded !== undefined && b.foursConceded > 0 && (
            <span className="tabular-nums">{b.foursConceded}×4</span>
          )}
          {b.sixesConceded !== undefined && b.sixesConceded > 0 && (
            <span className="tabular-nums">{b.sixesConceded}×6</span>
          )}
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
  )
}
