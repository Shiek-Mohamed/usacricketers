"use client"

/**
 * ScheduleView — public schedule page.
 *
 * Replaces the previous "wall of white" list with ESPNcricinfo-style matchup
 * cards (see MatchCard). Adds:
 *   - Upcoming / Recent / All tabs (replaces a single upcoming-only list)
 *   - Format filter chips (preserved from the previous version)
 *   - Team dropdown filter (new — useful for "show me all IND fixtures")
 *   - Month-grouped sticky headers (preserved)
 *   - A single 30-second tick at the view level so countdowns stay fresh
 *     without per-card timers
 *
 * The view is content-only — the surrounding `min-h-screen flex flex-col` +
 * `mt-auto` footer lives in the shared site shell and is not touched here.
 */

import { useEffect, useMemo, useState } from "react"
import { useMatches, useTeams } from "@/lib/use-data"
import type { Match } from "@/lib/types"
import { MatchCard } from "@/components/site/schedule-card"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

const FORMAT_FILTERS = [
  { key: "all", label: "All" },
  { key: "Test", label: "Test" },
  { key: "ODI", label: "ODI" },
  { key: "T20I", label: "T20I" },
  { key: "T10", label: "T10" },
] as const

const TAB_VALUES = ["upcoming", "recent", "all"] as const
type TabValue = (typeof TAB_VALUES)[number]

function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

interface MonthGroup {
  key: string
  label: string
  matches: Match[]
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}

function EmptyState({
  tab,
  format,
}: {
  tab: TabValue
  format: string
}) {
  const messages: Record<TabValue, string> = {
    upcoming: "No upcoming matches for this filter.",
    recent: "No recent results for this filter.",
    all: "No matches for this filter.",
  }
  const fmtLabel =
    FORMAT_FILTERS.find((f) => f.key === format)?.label ?? "this format"
  return (
    <Card className="grid min-h-[200px] place-items-center p-6">
      <div className="text-center">
        <div className="mb-2 text-3xl" aria-hidden="true">
          📅
        </div>
        <p className="text-sm text-muted-foreground">
          {messages[tab].replace("this filter", `${fmtLabel} filter`)}
        </p>
      </div>
    </Card>
  )
}

export function ScheduleView() {
  const { data, loading } = useMatches()
  const { data: teamsData } = useTeams()
  const [tab, setTab] = useState<TabValue>("upcoming")
  const [format, setFormat] = useState<string>("all")
  const [teamId, setTeamId] = useState<string>("all")

  // Single 30-second tick — re-renders the view so countdowns ("in 2h 15m")
  // stay fresh without per-card setInterval timers.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  // Read `tick` so the linter doesn't tree-shake it away; the value itself
  // isn't passed anywhere — re-rendering is the side-effect we want.
  void tick

  const allMatches = useMemo(() => data ?? [], [data])

  // Filter by tab + format + team, then sort.
  const filtered = useMemo(() => {
    const matches = allMatches

    const byTab = matches.filter((m) => {
      if (tab === "upcoming") {
        // Live matches show under Upcoming too — they're about to be in-play
        // and the "TODAY/LIVE" pill differentiates them anyway.
        return m.status === "upcoming" || m.status === "live"
      }
      if (tab === "recent") return m.status === "completed"
      return true // all
    })

    const byFormat =
      format === "all" ? byTab : byTab.filter((m) => m.format === format)

    const byTeam =
      teamId === "all"
        ? byFormat
        : byFormat.filter(
            (m) => m.team1Id === teamId || m.team2Id === teamId
          )

    // Sort: upcoming asc (next first), completed desc (most recent first).
    const sorted = [...byTeam].sort((a, b) => {
      const aTime = new Date(a.startDate).getTime()
      const bTime = new Date(b.startDate).getTime()
      if (tab === "recent") return bTime - aTime
      return aTime - bTime
    })

    return sorted
  }, [allMatches, tab, format, teamId])

  // Group by month (same logic as the previous version, preserved).
  const grouped = useMemo<MonthGroup[]>(() => {
    const groups: MonthGroup[] = []
    for (const m of filtered) {
      const k = monthKey(m.startDate)
      let g = groups.find((g) => g.key === k)
      if (!g) {
        g = { key: k, label: monthLabel(m.startDate), matches: [] }
        groups.push(g)
      }
      g.matches.push(m)
    }
    return groups
  }, [filtered])

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <CalendarDays className="h-6 w-6 text-red-600" aria-hidden="true" />
          Schedule
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          International cricket fixtures — upcoming, live and recent results.
        </p>
      </div>

      {/* Tabs: Upcoming / Recent / All */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
        aria-label="Schedule view tabs"
      >
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters: format chips + team dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Format filters"
        >
          {FORMAT_FILTERS.map((f) => {
            const active = format === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormat(f.key)}
                aria-pressed={active}
                className={cn(
                  "min-h-[36px] rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger
            className="w-[180px]"
            aria-label="Filter by team"
          >
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {(teamsData ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content: month-grouped MatchCards */}
      {loading ? (
        <ScheduleSkeleton />
      ) : grouped.length === 0 ? (
        <EmptyState tab={tab} format={format} />
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-3">
              <div className="sticky top-14 z-10 -mx-3 flex items-center gap-2 border-b bg-muted/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-md sm:px-4">
                <span
                  aria-hidden="true"
                  className="h-4 w-1 rounded-full bg-red-600"
                />
                <h2 className="text-sm font-extrabold uppercase tracking-tight">
                  {g.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  · {g.matches.length}{" "}
                  {g.matches.length === 1 ? "match" : "matches"}
                </span>
              </div>
              <div className="space-y-3">
                {g.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    allMatches={allMatches}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
