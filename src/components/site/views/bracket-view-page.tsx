"use client"

import { useState, useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { useSeries } from "@/lib/use-data"
import { serializeSeries } from "@/lib/serialize"
import { generateBracket, type Bracket, type BracketTeam } from "@/lib/tournament-brackets"
import { BracketView, BracketGenerator } from "@/components/cricket/bracket-view"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, ChevronLeft } from "lucide-react"

export function BracketPageView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data: seriesList, loading } = useSeries()

  // Bracket state (generated client-side)
  const [bracket, setBracket] = useState<Bracket | null>(null)

  // Find the selected series
  const selectedSeries = useMemo(() => {
    if (!id || !seriesList) return null
    return seriesList.find((s) => s.id === id) ?? null
  }, [id, seriesList])

  // Get teams for the selected series
  const seriesTeams = useMemo(() => {
    if (!selectedSeries) return []
    const serialized = serializeSeries(selectedSeries)
    // Teams come from the series's tournamentTeams relation
    return (serialized.teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
    }))
  }, [selectedSeries])

  const handleGenerate = (seededTeams: { id: string; name: string; shortName: string; seed: number }[]) => {
    const teams: BracketTeam[] = seededTeams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      seed: t.seed,
    }))
    const newBracket = generateBracket(teams)
    setBracket(newBracket)
  }

  // No series selected — show series picker
  if (!id) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          <h1 className="font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">
            Tournament Brackets
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a series to generate + view its knockout bracket.
        </p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {seriesList?.map((s) => {
              const serialized = serializeSeries(s)
              const teamCount = serialized.teams?.length ?? 0
              return (
                <button
                  key={s.id}
                  onClick={() => navigate("bracket", s.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-amber-300 hover:shadow-sm"
                >
                  <div>
                    <div className="font-display text-sm font-bold text-foreground">
                      {serialized.name}
                    </div>
                    <div className="font-display text-xs text-muted-foreground">
                      {serialized.format} · {teamCount} team{teamCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <Trophy className="h-4 w-4 text-amber-500" />
                </button>
              )
            }) ?? (
              <p className="text-sm text-muted-foreground">No series available.</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Series selected — show bracket generator + view
  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate("bracket")}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All series
      </button>

      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-amber-500" />
        <h1 className="font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">
          {selectedSeries?.name ?? "Bracket"}
        </h1>
      </div>

      {seriesTeams.length < 2 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This series needs at least 2 teams to generate a bracket.
            Current team count: {seriesTeams.length}
          </p>
        </div>
      ) : (
        <>
          {/* Generator (only shown if no bracket yet) */}
          {!bracket && (
            <BracketGenerator teams={seriesTeams} onGenerate={handleGenerate} />
          )}

          {/* Bracket display */}
          {bracket && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold uppercase tracking-wide">
                  {bracket.roundNames[bracket.roundNames.length - 1]} → {bracket.roundNames[0]}
                </h2>
                <button
                  onClick={() => setBracket(null)}
                  className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              </div>
              <BracketView bracket={bracket} />
            </>
          )}
        </>
      )}
    </div>
  )
}
