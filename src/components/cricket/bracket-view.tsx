"use client"

import { cn } from "@/lib/utils"
import { TeamBadge } from "@/components/cricket/ui"
import type { Bracket, BracketMatch } from "@/lib/tournament-brackets"
import { Trophy } from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  BracketView — renders a tournament bracket as a visual tree               */
/* -------------------------------------------------------------------------- */

export function BracketView({
  bracket,
  onMatchClick,
}: {
  bracket: Bracket
  onMatchClick?: (match: BracketMatch) => void
}) {
  if (!bracket.rounds.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">
          No bracket generated yet. Need at least 2 teams.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop: horizontal layout (rounds side by side) */}
      <div className="hidden md:flex md:gap-4 md:overflow-x-auto md:pb-2">
        {bracket.rounds.map((round, roundIdx) => (
          <div key={roundIdx} className="flex shrink-0 flex-col justify-around gap-3" style={{ minWidth: 220 }}>
            <RoundHeader name={bracket.roundNames[roundIdx]} matchCount={round.length} />
            {round.map((match) => (
              <BracketMatchCard
                key={match.id}
                match={match}
                onClick={onMatchClick}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Mobile: vertical layout (rounds stacked) */}
      <div className="space-y-4 md:hidden">
        {bracket.rounds.map((round, roundIdx) => (
          <div key={roundIdx}>
            <RoundHeader name={bracket.roundNames[roundIdx]} matchCount={round.length} />
            <div className="space-y-2">
              {round.map((match) => (
                <BracketMatchCard
                  key={match.id}
                  match={match}
                  onClick={onMatchClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function RoundHeader({ name, matchCount }: { name: string; matchCount: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-amber-500" />
      <h3 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
        {name}
      </h3>
      <span className="font-display text-[10px] font-medium text-muted-foreground">
        {matchCount} {matchCount === 1 ? "match" : "matches"}
      </span>
    </div>
  )
}

function BracketMatchCard({
  match,
  onClick,
}: {
  match: BracketMatch
  onClick?: (match: BracketMatch) => void
}) {
  const isBye = (match.team1 && !match.team2) || (!match.team1 && match.team2)
  const isPending = !match.team1 || !match.team2
  const isComplete = !!match.winnerId
  const hasLink = !!onClick && !!match.matchId

  const content = (
    <div
      className={cn(
        "rounded-lg border bg-white px-3 py-2 transition-all",
        isComplete && "border-emerald-300 bg-emerald-50/50",
        isBye && "border-dashed border-gray-200 bg-gray-50/50",
        !isComplete && !isBye && "border-gray-200",
        hasLink && "cursor-pointer hover:border-amber-300 hover:shadow-sm",
      )}
    >
      {/* Team 1 */}
      <BracketTeamRow
        team={match.team1}
        isWinner={match.winnerId === match.team1?.id}
        isLoser={isComplete && match.winnerId !== match.team1?.id && !!match.team1}
        score={isComplete && match.winnerId === match.team1?.id ? "W" : ""}
      />
      {/* Divider */}
      <div className="my-0.5 h-px bg-gray-100" />
      {/* Team 2 */}
      <BracketTeamRow
        team={match.team2}
        isWinner={match.winnerId === match.team2?.id}
        isLoser={isComplete && match.winnerId !== match.team2?.id && !!match.team2}
        score={isComplete && match.winnerId === match.team2?.id ? "W" : ""}
      />
    </div>
  )

  if (hasLink) {
    return (
      <button onClick={() => onClick?.(match)} className="block w-full text-left">
        {content}
      </button>
    )
  }
  return content
}

function BracketTeamRow({
  team,
  isWinner,
  isLoser,
  score,
}: {
  team: { id: string; name: string; shortName: string } | null
  isWinner: boolean
  isLoser: boolean
  score: string
}) {
  if (!team) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="font-display text-xs font-medium text-gray-400">— TBD —</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex min-w-0 items-center gap-1.5">
        {/* Team badge (mini) */}
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded font-display text-[8px] font-bold text-white"
          style={{ background: "#1e2a5e" }}
        >
          {team.shortName.slice(0, 2).toUpperCase()}
        </span>
        <span
          className={cn(
            "font-display text-xs font-bold truncate",
            isWinner && "text-emerald-700",
            isLoser && "text-gray-400",
            !isWinner && !isLoser && "text-foreground",
          )}
        >
          {team.name}
        </span>
      </div>
      {score && (
        <span className="ml-2 shrink-0 font-display text-[10px] font-bold text-emerald-600">
          {score}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  BracketGenerator — UI for generating a bracket from teams                  */
/* -------------------------------------------------------------------------- */

export function BracketGenerator({
  teams,
  onGenerate,
}: {
  teams: { id: string; name: string; shortName: string }[]
  onGenerate: (seededTeams: { id: string; name: string; shortName: string; seed: number }[]) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          Generate Knockout Bracket
        </h3>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Creates a single-elimination bracket from {teams.length} team{teams.length !== 1 ? "s" : ""}.
        {teams.length < 2 && " Need at least 2 teams."}
        {teams.length > 0 && teams.length < 4 && " Top seeds get byes."}
      </p>
      {teams.length >= 2 && (
        <button
          onClick={() =>
            onGenerate(
              teams.map((t, i) => ({ ...t, seed: i + 1 })),
            )
          }
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#1e2a5e] px-4 py-2 font-display text-sm font-bold text-white transition-colors hover:bg-[#283672]"
        >
          <Trophy className="h-4 w-4" />
          Generate Bracket
        </button>
      )}
    </div>
  )
}
