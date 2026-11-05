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
        <p className="text-sm text-foreground">
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
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      {/* Innings header — red-to-sky gradient (darker). White text for contrast. */}
      <div className="flex items-center justify-between bg-gradient-to-r from-red-700 to-sky-700 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <TeamBadgeByName shortName={innings.teamShortName} size="sm" />
          <span className="font-display text-xl font-bold uppercase tracking-wide">
            {innings.teamShortName}
          </span>
          <span className="font-display text-sm font-semibold uppercase tracking-wide text-white/70">{ordinal} innings</span>
        </div>
        <span className="font-display text-2xl font-black leading-none tabular-nums tracking-tight sm:text-3xl">
          {innings.totalRuns}<span className="text-white/60">/{innings.totalWickets}</span>
          {innings.declared && <span className="text-sm font-bold">d</span>}
          <span className="ml-2 font-display text-xs font-medium normal-case text-white/70">
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
      {isKeeper && <span className="ml-0.5 text-foreground">†</span>}
      {isCaptain && <span className="ml-0.5 text-foreground">(c)</span>}
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
    <div>
      {/* "BATTING" section label — light gray bar, uppercase, letter-spaced */}
      <div className="bg-[#f1f1f1] px-4 py-1.5">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-gray-500">Batting</span>
      </div>

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

      {/* Mobile: stacked rows with column headers matching the stat columns */}
      <div className="md:hidden">
        {/* Column header row — matches the stat column widths in BattingStackedRow */}
        <div className="flex items-baseline gap-2 border-b border-gray-200 bg-[#f8f8f8] px-4 py-1.5">
          <span className="flex-1 font-display text-xs font-bold uppercase tracking-widest text-gray-500">Batsman</span>
          <div className="flex shrink-0 items-baseline font-display text-xs font-bold uppercase tracking-widest text-gray-500">
            <span className="w-8 text-right">R</span>
            <span className="w-8 text-right">B</span>
            <span className="w-6 text-right">4s</span>
            <span className="w-6 text-right">6s</span>
            <span className="w-14 text-right">SR</span>
          </div>
        </div>
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
        {/* Column headers — light gray, gray text. Clean Cricinfo style. */}
        <tr className="bg-[#f8f8f8] text-gray-500">
          <th className="px-4 py-2 text-left font-display text-xs font-bold uppercase tracking-widest">Batsman</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">R</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">B</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">4s</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">6s</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">SR</th>
        </tr>
      </thead>
      <tbody>
        {batsmen.map((b, i) => (
          <BattingTableRow key={i} b={b} />
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

function BattingTableRow({ b }: { b: BattingLine }) {
  return (
    // No alternating colors. Current batsman gets a blue left border.
    <tr className={cn("border-b border-gray-100", b.isBatting && "border-l-[3px] border-l-sky-500")}>
      <td className="px-4 py-3 align-middle">
        {/* Name on the left (bold black), dismissal positioned to the RIGHT
            with a gap — looks like a separate column. Dismissal in gray. */}
        <div className="flex items-baseline gap-x-6 min-w-0">
          <PlayerName
            name={b.name}
            playerId={b.playerId}
            isCaptain={b.isCaptain}
            isKeeper={b.isKeeper}
            className="font-display text-base font-bold tracking-tight whitespace-nowrap text-black"
          />
          {b.dismissal && (
            <span className="text-sm text-gray-500 truncate">
              {b.dismissal}
            </span>
          )}
        </div>
      </td>
      {/* Runs — bold black (the key stat). Other stats — semibold gray. */}
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums text-black">
        {b.runs}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-semibold tabular-nums text-gray-700">
        {b.balls}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-semibold tabular-nums text-gray-700">
        {b.fours}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-semibold tabular-nums text-gray-700">
        {b.sixes}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-semibold tabular-nums text-gray-700">
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
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-baseline gap-x-6">
          <span className="font-display text-base font-bold text-black">Extras</span>
          {breakdown && (
            <span className="text-sm text-gray-500">({breakdown})</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums text-black">
        {row.runs}
      </td>
      <td className="px-3 py-3" />
      <td className="px-3 py-3" />
      <td className="px-3 py-3" />
      <td className="px-3 py-3" />
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
    <tr className="bg-[#f1f1f1] border-t border-gray-200">
      {/* Total label + overs/RR on one line (in the dismissal area) */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-baseline gap-x-6">
          <span className="font-display text-base font-bold tracking-tight whitespace-nowrap text-black">{label}</span>
          {runRate && (
            <span className="text-sm text-gray-600 font-medium">{innings.totalOvers} Ov (RR: {runRate})</span>
          )}
        </div>
      </td>
      {/* Score — right-aligned under the runs column */}
      <td className="px-3 py-3 text-right align-middle font-display text-lg font-black tabular-nums tracking-tight text-black whitespace-nowrap">
        {innings.totalRuns}<span className="text-gray-500">/{innings.totalWickets}</span>
        {innings.declared && <span className="text-sm">d</span>}
      </td>
      <td className="px-3 py-3" />
      <td className="px-3 py-3" />
      <td className="px-3 py-3" />
      <td className="px-3 py-3" />
    </tr>
  )
}

/* -------------------- Mobile batting stacked rows -------------------- */

function BattingStackedRow({ b, innings }: { b: BattingLine; innings: Innings }) {
  const extras = isExtrasRow(b.name)
  const total = isTotalRow(b.name)

  // Extras + Total rows — styled to match the desktop clean look
  if (extras || total) {
    return (
      <div className={cn("px-4 py-3", total ? "bg-[#f1f1f1] border-t border-gray-200" : "border-b border-gray-100")}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-x-3 min-w-0">
            <span className="font-display text-base font-bold text-black">{b.name}</span>
            {extras && innings.extrasBreakdown && (
              <span className="text-sm text-gray-500">({buildExtrasBreakdownString(innings.extrasBreakdown)})</span>
            )}
            {total && (() => {
              const rr = computeRunRate(innings)
              return rr && <span className="text-sm text-gray-600 font-medium">{innings.totalOvers} Ov (RR: {rr})</span>
            })()}
          </div>
          {total ? (
            <span className="font-display text-lg font-black tabular-nums text-black shrink-0">
              {innings.totalRuns}/{innings.totalWickets}
            </span>
          ) : (
            <span className="font-display text-base font-bold tabular-nums text-black shrink-0">{b.runs}</span>
          )}
        </div>
      </div>
    )
  }

  // Normal batsman row — matches the reference mobile design:
  // Line 1: name (left, bold) + ALL stats (R B 4s 6s SR) right-aligned in columns
  // Line 2: dismissal only (gray, below name)
  return (
    <div className={cn("border-b border-gray-100 px-4 py-3", b.isBatting && "border-l-[3px] border-l-sky-500")}>
      {/* Line 1: name + all stats in right-aligned columns */}
      <div className="flex items-baseline gap-2">
        <div className="flex items-baseline gap-x-2 min-w-0 flex-1">
          {b.isBatting && (
            <span className="h-2 w-2 shrink-0 self-center rounded-full bg-red-600 animate-pulse" />
          )}
          <PlayerName
            name={b.name}
            playerId={b.playerId}
            isCaptain={b.isCaptain}
            isKeeper={b.isKeeper}
            className="font-display text-base font-bold text-black truncate"
          />
        </div>
        {/* Stats — fixed-width columns, right-aligned, regular weight (not bold).
            The widths keep them aligned across all batsmen. */}
        <div className="flex shrink-0 items-baseline font-display tabular-nums text-sm text-gray-900">
          <span className="w-8 text-right">{b.runs}</span>
          <span className="w-8 text-right">{b.balls}</span>
          <span className="w-6 text-right">{b.fours}</span>
          <span className="w-6 text-right">{b.sixes}</span>
          <span className="w-14 text-right">{b.strikeRate > 0 ? b.strikeRate.toFixed(1) : "—"}</span>
        </div>
      </div>
      {/* Line 2: dismissal only (gray, below name) */}
      {b.dismissal && (
        <div className="mt-1 text-sm text-gray-500 truncate pl-4">{b.dismissal}</div>
      )}
    </div>
  )
}

function BattingStackedTotalRow({ innings }: { innings: Innings }) {
  const runRate = computeRunRate(innings)
  return (
    <div className="flex items-baseline justify-between bg-[#f1f1f1] border-t border-gray-200 px-4 py-3">
      <div className="flex items-baseline gap-x-3">
        <span className="font-display text-base font-bold text-black">Total</span>
        {runRate && <span className="text-sm text-gray-600 font-medium">{innings.totalOvers} Ov (RR: {runRate})</span>}
      </div>
      <span className="font-display text-lg font-black tabular-nums text-black">
        {innings.totalRuns}/{innings.totalWickets}
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
      <span className="text-xs font-bold uppercase tracking-wide text-foreground">
        Did not bat:{" "}
      </span>
      <span className="text-foreground">
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
        Fall of Wickets
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {fow.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-foreground/40">,</span>}
            <span className="tabular-nums text-foreground">{w}</span>
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
        Partnerships
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {partnerships.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-foreground/40">,</span>}
            <span className="tabular-nums text-foreground">{p}</span>
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
      {/* "BOWLING" section label — matches the "BATTING" label above */}
      <div className="bg-[#f1f1f1] px-4 py-1.5">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-gray-500">Bowling</span>
      </div>
      {/* Desktop: proper table */}
      <div className="hidden md:block">
        <BowlingTable bowling={innings.bowling} />
      </div>
      {/* Mobile: stacked rows with column headers matching the stat columns */}
      <div className="md:hidden">
        {/* Column header row — O M R W ECON */}
        <div className="flex items-baseline gap-2 border-b border-gray-200 bg-[#f8f8f8] px-4 py-1.5">
          <span className="flex-1 font-display text-xs font-bold uppercase tracking-widest text-gray-500">Bowler</span>
          <div className="flex shrink-0 items-baseline font-display text-xs font-bold uppercase tracking-widest text-gray-500">
            <span className="w-10 text-right">O</span>
            <span className="w-6 text-right">M</span>
            <span className="w-8 text-right">R</span>
            <span className="w-6 text-right">W</span>
            <span className="w-12 text-right">Econ</span>
          </div>
        </div>
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
        <tr className="bg-[#f8f8f8] text-gray-500">
          <th className="px-4 py-2 text-left font-display text-xs font-bold uppercase tracking-widest">Bowler</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">O</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">M</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">R</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">W</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">Econ</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">0s</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">4s</th>
          <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-widest tabular-nums">6s</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
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
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          {b.isBowling && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-600 animate-pulse" />
          )}
          <PlayerName name={b.name} playerId={b.playerId} className="font-display text-base font-bold tracking-tight whitespace-nowrap" />
        </div>
      </td>
      {/* All stat columns: SAME size (text-base), SAME weight (font-bold),
          SAME padding (px-2 py-3), SAME alignment. Matches the batting row. */}
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">{b.overs}</td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">
        {b.maidens}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">
        {b.runs}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">
        {b.wickets}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">
        {b.economy > 0 ? b.economy.toFixed(2) : "—"}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">
        {b.dots ?? 0}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">
        {b.foursConceded ?? 0}
      </td>
      <td className="px-3 py-3 text-right align-middle font-display text-base font-bold tabular-nums">
        {b.sixesConceded ?? 0}
      </td>
    </tr>
  )
}

function BowlingStackedRow({ b, zebra }: { b: BowlingLine; zebra: boolean }) {
  return (
    // Single line: name (left, bold) + O M R W ECON (right, fixed columns).
    // Wickets is bold (the key stat); others regular weight. Matches the
    // reference mobile bowling design.
    <div className={cn("border-b border-gray-100 px-4 py-3", b.isBowling && "border-l-[3px] border-l-sky-500")}>
      <div className="flex items-baseline gap-2">
        <div className="flex items-baseline gap-x-2 min-w-0 flex-1">
          {b.isBowling && (
            <span className="h-2 w-2 shrink-0 self-center rounded-full bg-red-600 animate-pulse" />
          )}
          <PlayerName
            name={b.name}
            playerId={b.playerId}
            className="font-display text-base font-bold text-black truncate"
          />
        </div>
        {/* Stats — fixed-width columns matching the header row.
            Wickets is bold; others regular weight. */}
        <div className="flex shrink-0 items-baseline font-display tabular-nums text-sm text-gray-900">
          <span className="w-10 text-right">{b.overs}</span>
          <span className="w-6 text-right">{b.maidens}</span>
          <span className="w-8 text-right">{b.runs}</span>
          <span className="w-6 text-right font-bold text-black">{b.wickets}</span>
          <span className="w-12 text-right">{b.economy > 0 ? b.economy.toFixed(2) : "—"}</span>
        </div>
      </div>
    </div>
  )
}
