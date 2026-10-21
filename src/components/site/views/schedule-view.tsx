"use client"

import { useMemo, useState } from "react"
import { useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import type { Match } from "@/lib/types"
import {
  TeamBadge,
  FormatPill,
  formatMatchTime,
} from "@/components/cricket/ui"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CalendarDays, MapPin, ChevronRight } from "lucide-react"

const FORMAT_FILTERS = [
  { key: "all", label: "All" },
  { key: "Test", label: "Test" },
  { key: "ODI", label: "ODI" },
  { key: "T20I", label: "T20I" },
  { key: "T10", label: "T10" },
]

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function weekdayShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short" })
}

function dayNumber(iso: string) {
  return new Date(iso).getDate()
}

function shortMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short" })
}

function ScheduleRow({ match }: { match: Match }) {
  const navigate = useAppStore((s) => s.navigate)
  const t1 = match.team1
  const t2 = match.team2

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate("match-detail", match.id)}
    >
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
        {/* Date */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:justify-center sm:border-r sm:pr-4">
          <div className="text-center">
            <div className="text-2xl font-extrabold leading-none tabular-nums text-foreground sm:text-3xl">
              {dayNumber(match.startDate)}
            </div>
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">
              {shortMonth(match.startDate)}
            </div>
          </div>
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            {weekdayShort(match.startDate)}
          </div>
          <div className="text-[10px] text-muted-foreground sm:hidden">
            · {formatMatchTime(match.startDate)}
          </div>
        </div>

        {/* Match info */}
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <FormatPill format={match.format} />
            <span className="text-xs text-muted-foreground">
              {match.matchNo}
            </span>
            {match.series?.shortName && (
              <span className="truncate text-xs text-muted-foreground">
                · {match.series.shortName}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {t1 && (
              <div className="flex items-center gap-2">
                <TeamBadge team={t1} size="sm" />
                <span className="truncate text-sm font-semibold">
                  {t1.name}
                </span>
              </div>
            )}
            {t2 && (
              <div className="flex items-center gap-2">
                <TeamBadge team={t2} size="sm" />
                <span className="truncate text-sm font-semibold">
                  {t2.name}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {match.venue}
              {match.city ? `, ${match.city}` : ""}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              {formatMatchTime(match.startDate)}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="hidden items-center justify-end sm:flex">
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  )
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function ScheduleView() {
  const { data, loading } = useMatches()
  const [format, setFormat] = useState<string>("all")

  const upcoming = useMemo(() => {
    const all = (data ?? []).filter((m) => m.status === "upcoming")
    const filtered =
      format === "all" ? all : all.filter((m) => m.format === format)
    return [...filtered].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )
  }, [data, format])

  // Group by month
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; matches: Match[] }[] = []
    for (const m of upcoming) {
      const k = monthKey(m.startDate)
      let g = groups.find((g) => g.key === k)
      if (!g) {
        g = { key: k, label: monthLabel(m.startDate), matches: [] }
        groups.push(g)
      }
      g.matches.push(m)
    }
    return groups
  }, [upcoming])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <CalendarDays className="h-6 w-6 text-red-600" />
          Schedule
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming international cricket fixtures.
        </p>
      </div>

      {/* Format filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FORMAT_FILTERS.map((f) => {
          const active = format === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={cn(
                "rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-pressed={active}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <ScheduleSkeleton />
      ) : grouped.length === 0 ? (
        <Card className="grid min-h-[200px] place-items-center p-6">
          <div className="text-center">
            <div className="mb-2 text-3xl">📅</div>
            <p className="text-sm text-muted-foreground">
              No upcoming matches for this filter.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-3">
              <div className="sticky top-14 z-10 -mx-3 flex items-center gap-2 border-b bg-muted/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-md sm:px-4">
                <span className="h-4 w-1 rounded-full bg-red-600" />
                <h2 className="text-sm font-extrabold uppercase tracking-tight">
                  {g.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  · {g.matches.length} {g.matches.length === 1 ? "match" : "matches"}
                </span>
              </div>
              <div className="space-y-3">
                {g.matches.map((m) => (
                  <ScheduleRow key={m.id} match={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
