"use client"

import { cn } from "@/lib/utils"
import type { LiveMatchState } from "@/lib/scoring"

/* -------------------------------------------------------------------------- */
/*  Ball chip — a colored square showing the ball result (4, 6, W, •, 1, wd)  */
/*  Inspired by ESPNcricinfo's over ribbon. Color-coded for instant scanning. */
/* -------------------------------------------------------------------------- */

type CommentaryEntry = LiveMatchState["commentary"][number]

interface ChipData {
  label: string
  bg: string
  text: string
}

/** Extract the ball-chip data (label + colors) from a commentary entry.
 *  Returns null for entries that don't get a chip (over summaries, info,
 *  manual commentator notes). */
export function getBallChipData(entry: CommentaryEntry): ChipData | null {
  switch (entry.kind) {
    case "six":
      return { label: "6", bg: "bg-green-600", text: "text-white" }
    case "boundary":
      return { label: "4", bg: "bg-green-600", text: "text-white" }
    case "wicket":
      return { label: "W", bg: "bg-red-600", text: "text-white" }
    case "dot":
      return { label: "•", bg: "bg-gray-300", text: "text-gray-700" }
    case "run": {
      // Text is like "1 runs — PlayerName" or "2 runs — PlayerName"
      const match = entry.text.match(/^(\d+)/)
      const runs = match ? match[1] : "1"
      return { label: runs, bg: "bg-sky-500", text: "text-white" }
    }
    case "extra": {
      if (entry.text.startsWith("Wide"))
        return { label: "wd", bg: "bg-orange-500", text: "text-white" }
      if (entry.text.startsWith("No ball"))
        return { label: "nb", bg: "bg-orange-500", text: "text-white" }
      if (entry.text.startsWith("Bye"))
        return { label: "b", bg: "bg-orange-400", text: "text-white" }
      if (entry.text.startsWith("Leg bye"))
        return { label: "lb", bg: "bg-orange-400", text: "text-white" }
      return { label: "e", bg: "bg-orange-500", text: "text-white" }
    }
    // No chip for these — they're not balls
    case "over":
    case "info":
    case "manual":
    default:
      return null
  }
}

/** BallChip — a compact colored square with the ball result inside.
 *  Used in the commentary feed + key moments. */
export function BallChip({
  entry,
  size = "md",
}: {
  entry: CommentaryEntry
  size?: "sm" | "md"
}) {
  const data = getBallChipData(entry)
  if (!data) return null

  const sizes = {
    sm: "h-5 w-5 text-[9px]",
    md: "h-6 w-6 text-[10px]",
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded font-display font-bold tabular-nums leading-none",
        sizes[size],
        data.bg,
        data.text,
      )}
    >
      {data.label}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Over summary card — a pale card at each over boundary showing the score    */
/*  "End of over 5 — IND 187/4 (42.4)" rendered as a visual anchor in the feed */
/* -------------------------------------------------------------------------- */

export function isOverSummary(entry: CommentaryEntry): boolean {
  return entry.kind === "over"
}

export function OverSummaryCard({ entry }: { entry: CommentaryEntry }) {
  // entry.text is like "End of over 5 — IND 187/4 (42.4)"
  // Split it into label + score for nicer formatting
  const text = entry.text
  const overMatch = text.match(/over (\d+)/)
  const overNo = overMatch ? overMatch[1] : ""
  const scorePart = text.split("—")[1]?.trim() ?? text

  return (
    <div className="flex items-center gap-2 bg-sky-50 px-3 py-2 border-l-[3px] border-sky-400">
      <span className="font-display text-xs font-bold uppercase tracking-widest text-sky-700 shrink-0">
        Over {overNo}
      </span>
      <span className="font-display text-sm font-bold tabular-nums text-gray-800 truncate">
        {scorePart}
      </span>
      <span className="ml-auto font-display text-[10px] font-medium text-gray-400 shrink-0">
        {entry.over}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  CommentaryRow — a single row in the commentary feed with a ball chip.      */
/*  Shared between LiveMatchSection + LiveBlogView for consistent styling.     */
/*  - Over summary entries → OverSummaryCard (full width)                      */
/*  - Ball entries → ball chip + over label + text                             */
/*  - Info/manual entries → no chip, just text                                 */
/* -------------------------------------------------------------------------- */

export function CommentaryFeedRow({ entry }: { entry: CommentaryEntry }) {
  // Over summary → render as a card, not a row
  if (isOverSummary(entry)) {
    return <OverSummaryCard entry={entry} />
  }

  const chip = getBallChipData(entry)
  const isAudio = entry.text.startsWith("[audio:")
  const audioUrl = isAudio ? entry.text.slice(7, -1) : null

  return (
    <div
      className={cn(
        "flex gap-2.5 border-b border-border/40 px-3 py-2 last:border-0",
        entry.kind === "wicket" && "bg-red-50/50",
        entry.kind === "six" && "bg-purple-50/30",
        entry.kind === "boundary" && "bg-sky-50/30",
      )}
    >
      {/* Ball chip (or over label for non-ball entries) */}
      {chip ? (
        <BallChip entry={entry} />
      ) : (
        <span className="w-6 shrink-0 text-right font-display text-[11px] font-bold tabular-nums text-gray-400">
          {entry.over}
        </span>
      )}

      {/* Text */}
      <div className="min-w-0 flex-1 pt-0.5">
        {isAudio && audioUrl ? (
          <audio controls src={audioUrl} className="h-8 w-full max-w-xs" preload="none" />
        ) : (
          <span className="text-[13px] leading-relaxed text-foreground">
            {entry.text}
          </span>
        )}
      </div>
    </div>
  )
}
