"use client"

import {
  useTeams,
  usePlayers,
  useMatches,
  useSeries,
  useArticles,
} from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { AdminShell } from "@/components/admin/admin-shell"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  StatusPill,
  FormatPill,
  formatMatchDate,
  timeAgo,
} from "@/components/cricket/ui"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Users,
  UserSearch,
  Activity,
  Trophy,
  FileText,
  ArrowRight,
  Zap,
  Clock,
  Radio,
  Plus,
  Pencil,
  CalendarDays,
} from "lucide-react"
import type { ViewKey } from "@/lib/types"

export function DashboardView() {
  const navigate = useAppStore((s) => s.navigate)
  const teams = useTeams()
  const players = usePlayers()
  const matches = useMatches()
  const series = useSeries()
  const articles = useArticles()

  const stats: {
    label: string
    count: number
    icon: React.ElementType
    color: string
    bg: string
    view: ViewKey
  }[] = [
    {
      label: "Teams",
      count: teams.data?.length ?? 0,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      view: "admin-teams",
    },
    {
      label: "Players",
      count: players.data?.length ?? 0,
      icon: UserSearch,
      color: "text-amber-600",
      bg: "bg-amber-50",
      view: "admin-players",
    },
    {
      label: "Matches",
      count: matches.data?.length ?? 0,
      icon: Activity,
      color: "text-red-600",
      bg: "bg-red-50",
      view: "admin-matches",
    },
    {
      label: "Series",
      count: series.data?.length ?? 0,
      icon: Trophy,
      color: "text-rose-600",
      bg: "bg-rose-50",
      view: "admin-series",
    },
    {
      label: "Articles",
      count: articles.data?.total ?? 0,
      icon: FileText,
      color: "text-slate-700",
      bg: "bg-slate-100",
      view: "admin-articles",
    },
  ]

  const recentArticles = (articles.data?.items ?? []).slice(0, 5)
  const recentMatches = (matches.data ?? []).slice(0, 5)
  const liveMatches = (matches.data ?? []).filter((m) => m.status === "live")
  const loading =
    teams.loading ||
    players.loading ||
    series.loading ||
    articles.loading

  return (
    <AdminShell title="Dashboard">
      {/* Live matches banner */}
      {liveMatches.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] dark:ring-1 dark:ring-white/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live Now
            </span>
            <span className="text-sm text-white/50">{liveMatches.length} match{liveMatches.length > 1 ? "es" : ""} in progress</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {liveMatches.map((m) => {
              const sc = m.scorecard
              const t1Score = sc?.innings?.filter((i) => i.teamId === m.team1Id).map((i) => `${i.totalRuns}/${i.totalWickets}`).join(" · ")
              const t2Score = sc?.innings?.filter((i) => i.teamId === m.team2Id).map((i) => `${i.totalRuns}/${i.totalWickets}`).join(" · ")
              return (
                <a
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex min-w-[200px] flex-1 items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
                >
                  <div className="text-center">
                    <div className="text-xs font-bold uppercase text-white/70">{m.team1?.shortName}</div>
                    {t1Score ? <div className="text-sm font-extrabold text-white">{t1Score}</div> : <div className="text-xs text-white/40">—</div>}
                  </div>
                  <span className="text-xs font-bold text-white/30">vs</span>
                  <div className="text-center">
                    <div className="text-xs font-bold uppercase text-white/70">{m.team2?.shortName}</div>
                    {t2Score ? <div className="text-sm font-extrabold text-white">{t2Score}</div> : <div className="text-xs text-white/40">—</div>}
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => navigate("admin-matches")}>
          <Plus className="h-3.5 w-3.5" /> New Match
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("admin-players")}>
          <UserSearch className="h-3.5 w-3.5" /> Add Player
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("admin-articles")}>
          <Pencil className="h-3.5 w-3.5" /> Write Article
        </Button>
        {liveMatches.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => navigate("live-scorer", liveMatches[0].id)}>
            <Radio className="h-3.5 w-3.5" /> Score Live
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="overflow-hidden">
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg ${s.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loading ? (
                      <Skeleton className="h-7 w-10" />
                    ) : (
                      s.count
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start px-0 text-xs h-auto py-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate(s.view)}
                >
                  Manage →
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent articles */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Articles</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("admin-articles")}
                className="text-xs gap-1"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : recentArticles.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No articles yet.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Author
                      </TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentArticles.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="max-w-[200px] truncate">
                          {a.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {a.categories[0]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {a.author}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {timeAgo(a.publishedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent matches */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Matches</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("admin-matches")}
                className="text-xs gap-1"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : recentMatches.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No matches yet.
              </div>
            ) : (
              <ul className="divide-y max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                {recentMatches.map((m) => (
                  <li
                    key={m.id}
                    className="px-4 py-2.5 flex items-center gap-3"
                  >
                    <FormatPill format={m.format} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {m.team1?.shortName} v {m.team2?.shortName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.venue || m.city || "—"}
                      </div>
                    </div>
                    <StatusPill status={m.status} />
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      {formatMatchDate(m.startDate)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recently edited — cross-entity activity feed */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" /> Recently Edited
            </CardTitle>
            <span className="text-xs text-muted-foreground">Last changes across all content</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            (() => {
              // Merge all entity types, sort by updatedAt desc, take 5.
              type Activity = { id: string; name: string; type: string; updatedAt: string; view: ViewKey }
              const all: Activity[] = []
              for (const a of articles.data?.items ?? [])
                all.push({ id: a.id, name: a.title, type: "Article", updatedAt: a.updatedAt, view: "admin-articles" })
              for (const m of matches.data ?? [])
                all.push({ id: m.id, name: `${m.team1?.shortName ?? "?"} v ${m.team2?.shortName ?? "?"} — ${m.matchNo}`, type: "Match", updatedAt: m.updatedAt, view: "admin-matches" })
              for (const t of teams.data ?? [])
                all.push({ id: t.id, name: t.name, type: "Team", updatedAt: t.updatedAt, view: "admin-teams" })
              for (const p of players.data ?? [])
                all.push({ id: p.id, name: p.name, type: "Player", updatedAt: p.updatedAt, view: "admin-players" })
              for (const s of series.data ?? [])
                all.push({ id: s.id, name: s.name, type: "Series", updatedAt: s.updatedAt, view: "admin-series" })
              all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              const recent = all.slice(0, 6)

              if (recent.length === 0) {
                return <div className="p-6 text-sm text-muted-foreground">No recent activity.</div>
              }

              const typeColors: Record<string, string> = {
                Article: "bg-slate-100 text-slate-700",
                Match: "bg-red-50 text-red-700",
                Team: "bg-emerald-50 text-emerald-700",
                Player: "bg-amber-50 text-amber-700",
                Series: "bg-rose-50 text-rose-700",
              }
              const typeIcons: Record<string, React.ElementType> = {
                Article: FileText,
                Match: Activity,
                Team: Users,
                Player: UserSearch,
                Series: Trophy,
              }

              return (
                <ul className="divide-y max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                  {recent.map((item) => {
                    const Icon = typeIcons[item.type] || FileText
                    return (
                      <li key={`${item.type}-${item.id}`}>
                        <button
                          onClick={() => navigate(item.view)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                        >
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${typeColors[item.type]}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.type}</div>
                          </div>
                          <div className="shrink-0 text-xs text-muted-foreground">
                            {timeAgo(item.updatedAt)}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            })()
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" /> Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {stats.map((s) => {
              const Icon = s.icon
              return (
                <Button
                  key={s.label}
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(s.view)}
                  className="justify-start gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" /> {s.label}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  )
}
