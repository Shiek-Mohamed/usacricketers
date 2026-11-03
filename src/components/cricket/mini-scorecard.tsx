"use client"

import type { Match } from "@/lib/types"
import { TeamBadge, StatusPill, FormatPill, formatMatchDate } from "./ui"
import { cn } from "@/lib/utils"

export function MiniScorecard({ match }: { match: Match }) {
  const t1 = match.team1
  const t2 = match.team2
  const live = match.status === "live"

  // Determine which innings are batting now and the latest total
  const sc = match.scorecard
  let t1Score = ""
  let t2Score = ""
  if (sc?.innings?.length) {
    for (const inn of sc.innings) {
      const isT1 = inn.teamId === match.team1Id
      if (isT1) t1Score = `${inn.totalRuns}/${inn.totalWickets} (${inn.totalOvers})`
      else t2Score = `${inn.totalRuns}/${inn.totalWickets} (${inn.totalOvers})`
    }
  }

  // Render as a real `<a href="/matches/${id}">` so the card deep-links to
  // the SSR match page (full page navigation — what we want for SEO +
  // shareability). The SPA `?view=match-detail&id=xxx` flow still works for
  // legacy links.
  const href = `/matches/${match.id}`

  return (
    <a
      href={href}
      className={cn(
        "block w-full text-left rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-md",
        live && "border-red-300"
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <FormatPill format={match.format} />
          <span className="truncate text-xs text-muted-foreground">
            {match.matchNo} · {match.series?.shortName || match.format}
          </span>
        </div>
        <StatusPill status={match.status} />
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <TeamLine
          team={t1}
          score={t1Score}
          batting={live && t1Score && !t2Score}
        />
        <TeamLine
          team={t2}
          score={t2Score}
          batting={live && t2Score && t1Score}
        />
      </div>
      <div className="px-3 pb-2 text-[11px] text-muted-foreground">
        {match.result || `${match.venue}, ${formatMatchDate(match.startDate)}`}
      </div>
    </a>
  )
}

function TeamLine({
  team,
  score,
  batting,
}: {
  team?: Match["team1"]
  score: string
  batting?: boolean
}) {
  if (!team) return null
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <TeamBadge team={team} size="sm" />
        <span className="truncate text-sm font-medium">{team.shortName}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {batting && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
        )}
        <span
          className={cn(
            "text-sm tabular-nums",
            score ? "font-bold" : "text-muted-foreground"
          )}
        >
          {score || "—"}
        </span>
      </div>
    </div>
  )
}
