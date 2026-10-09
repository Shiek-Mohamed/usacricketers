"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Trophy } from "lucide-react"
import {
  useSeries,
} from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { formatMatchDate, StatusPill } from "@/components/cricket/ui"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Series } from "@/lib/types"

type FilterKey = "all" | "upcoming" | "ongoing" | "completed"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
]

// Format → gradient color (cricket palette: emerald/red/amber, no blue/indigo)
function formatGradient(format: string): string {
  switch (format) {
    case "Test":
      return "linear-gradient(135deg,#b91c1c 0%,#7f1d1d 100%)"
    case "ODI":
      return "linear-gradient(135deg,#059669 0%,#065f46 100%)"
    case "T20I":
      return "linear-gradient(135deg,#d97706 0%,#92400e 100%)"
    default:
      return "linear-gradient(135deg,#475569 0%,#1e293b 100%)"
  }
}

export function SeriesView() {
  const { data: series, loading } = useSeries()
  const navigate = useAppStore((s) => s.navigate)
  const [filter, setFilter] = useState<FilterKey>("all")

  const filtered = useMemo(() => {
    if (!series) return []
    if (filter === "all") return series
    return series.filter((s) => s.status === filter)
  }, [series, filter])

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Trophy className="size-6 text-emerald-600" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Series
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Browse all international cricket series — Tests, ODIs and T20Is.
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f.key
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-border bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No series found for this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SeriesCard key={s.id} series={s} onClick={() => navigate("series-detail", s.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function SeriesCard({
  series,
  onClick,
}: {
  series: Series
  onClick: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className="group cursor-pointer gap-0 overflow-hidden p-0 py-0 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      {/* Banner header */}
      <div
        className="px-4 py-3 text-white"
        style={{ background: formatGradient(series.format) }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-lg font-extrabold tracking-tight">
            {series.shortName}
          </span>
          <span className="inline-flex items-center rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/30">
            {series.format}
          </span>
        </div>
      </div>

      <CardContent className="space-y-3 p-4">
        <div>
          <p className="line-clamp-1 font-semibold leading-snug">{series.name}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {series.description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <StatusPill status={series.status} />
          <span className="text-[11px] font-medium text-muted-foreground">
            {series.season}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          <span>
            {formatMatchDate(series.startDate)} — {formatMatchDate(series.endDate)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
