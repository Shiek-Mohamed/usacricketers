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
      count: articles.data?.length ?? 0,
      icon: FileText,
      color: "text-slate-700",
      bg: "bg-slate-100",
      view: "admin-articles",
    },
  ]

  const recentArticles = (articles.data ?? []).slice(0, 5)
  const recentMatches = (matches.data ?? []).slice(0, 5)
  const loading =
    teams.loading ||
    players.loading ||
    matches.loading ||
    series.loading ||
    articles.loading

  return (
    <AdminShell title="Dashboard">
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
                            {a.category}
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
