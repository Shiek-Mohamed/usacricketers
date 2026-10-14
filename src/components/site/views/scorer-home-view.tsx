"use client"

import { useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Radio, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function ScorerHomeView() {
  const { data, loading } = useMatches()
  const navigate = useAppStore((s) => s.navigate)

  const matches = data ?? []
  const liveMatches = matches.filter((m) => m.status === "live")
  const upcoming = matches.filter((m) => m.status === "upcoming")
  const completed = matches.filter((m) => m.status === "completed").slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Live matches */}
      {liveMatches.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            Live Now ({liveMatches.length})
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {liveMatches.map((m) => (
              <MatchRow key={m.id} match={m} onClick={() => navigate("live-scorer", m.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Upcoming ({upcoming.length})
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {upcoming.map((m) => (
              <MatchRow key={m.id} match={m} onClick={() => navigate("live-scorer", m.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Recently completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Recently Completed
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {completed.map((m) => (
              <MatchRow key={m.id} match={m} onClick={() => navigate("live-scorer", m.id)} />
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && matches.length === 0 && (
        <Card className="grid place-items-center p-6">
          <p className="text-sm text-muted-foreground">No matches available to score.</p>
        </Card>
      )}
    </div>
  )
}

function MatchRow({ match, onClick }: { match: any; onClick: () => void }) {
  const isLive = match.status === "live"
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left transition-shadow hover:shadow-md",
        isLive && "border-red-300 bg-red-50"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex items-center gap-1.5">
          {match.team1 && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: match.team1.primaryColor }}>
              {match.team1.shortName.slice(0, 2)}
            </span>
          )}
          <span className="text-sm font-semibold">{match.team1?.shortName ?? "TBD"}</span>
        </div>
        <span className="text-xs text-muted-foreground">v</span>
        <div className="flex items-center gap-1.5">
          {match.team2 && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: match.team2.primaryColor }}>
              {match.team2.shortName.slice(0, 2)}
            </span>
          )}
          <span className="text-sm font-semibold">{match.team2?.shortName ?? "TBD"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{match.matchNo}</span>
        {isLive ? (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Live</span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground capitalize">{match.status}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  )
}
