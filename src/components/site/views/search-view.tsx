"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search as SearchIcon,
  Newspaper,
  Users,
  Trophy,
  UserSearch,
  Play,
  ArrowLeft,
} from "lucide-react"
import { TeamBadge, PlayerAvatar, FormatPill } from "@/components/cricket/ui"
import { ArticleCard } from "@/components/cricket/article-card"
import type { Article, Team, Series, Video } from "@/lib/types"

interface SearchResult {
  articles: Article[]
  players: { id: string; name: string; role: string; teamId: string; teamShortName: string; imageUrl: string }[]
  teams: Team[]
  series: Series[]
  videos: Video[]
}

export function SearchView() {
  const id = useAppStore((s) => s.id) // repurposed as the initial query
  const navigate = useAppStore((s) => s.navigate)
  const [query, setQuery] = useState(id ?? "")
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) {
          setResults(await res.json())
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const hasResults =
    results &&
    (results.articles.length > 0 ||
      results.players.length > 0 ||
      results.teams.length > 0 ||
      results.series.length > 0 ||
      results.videos.length > 0)

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("home")}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Button>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles, players, teams, series, videos..."
            className="h-11 pl-10 text-base"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && query.trim().length >= 2 && !hasResults && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No results found for &ldquo;{query}&rdquo;. Try a different search.
          </CardContent>
        </Card>
      )}

      {!loading && results && (
        <div className="space-y-6">
          {/* Articles */}
          {results.articles.length > 0 && (
            <SearchSection icon={Newspaper} title="Articles" count={results.articles.length}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {results.articles.map((a) => (
                  <ArticleCard key={a.id} article={a} variant="default" />
                ))}
              </div>
            </SearchSection>
          )}

          {/* Players */}
          {results.players.length > 0 && (
            <SearchSection icon={UserSearch} title="Players" count={results.players.length}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {results.players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate("player-detail", p.id)}
                    className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-shadow hover:shadow-md"
                  >
                    <PlayerAvatar name={p.name} src={p.imageUrl} size="lg" />
                    <div>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">{p.role}</div>
                      <div className="text-[11px] font-medium">{p.teamShortName}</div>
                    </div>
                  </button>
                ))}
              </div>
            </SearchSection>
          )}

          {/* Teams */}
          {results.teams.length > 0 && (
            <SearchSection icon={Users} title="Teams" count={results.teams.length}>
              <div className="flex flex-wrap gap-3">
                {results.teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate("team-detail", t.id)}
                    className="flex items-center gap-2 rounded-lg border px-4 py-2.5 transition-shadow hover:shadow-md"
                  >
                    <TeamBadge team={t} size="sm" />
                    <span className="font-bold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.country}</span>
                  </button>
                ))}
              </div>
            </SearchSection>
          )}

          {/* Series */}
          {results.series.length > 0 && (
            <SearchSection icon={Trophy} title="Series" count={results.series.length}>
              <div className="space-y-2">
                {results.series.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate("series-detail", s.id)}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-shadow hover:shadow-md"
                  >
                    <FormatPill format={s.format} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.season}</div>
                    </div>
                  </button>
                ))}
              </div>
            </SearchSection>
          )}

          {/* Videos */}
          {results.videos.length > 0 && (
            <SearchSection icon={Play} title="Videos" count={results.videos.length}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.videos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => navigate("video-detail", v.id)}
                    className="flex flex-col gap-2 rounded-lg border p-3 text-left transition-shadow hover:shadow-md"
                  >
                    <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                      {v.thumbnailUrl && (
                        <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="text-sm font-bold line-clamp-2">{v.title}</div>
                    <div className="text-[11px] text-muted-foreground">{v.category}</div>
                  </button>
                ))}
              </div>
            </SearchSection>
          )}
        </div>
      )}
    </div>
  )
}

function SearchSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ElementType
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-red-600" />
        <Icon className="h-4 w-4 text-red-600" />
        <h2 className="text-sm font-extrabold uppercase tracking-tight sm:text-base">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      {children}
    </section>
  )
}
