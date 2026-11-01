"use client"

import { useEffect, useState } from "react"
import { useArticles, useMatches } from "@/lib/use-data"
import { ArticleCard } from "@/components/cricket/article-card"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Newspaper, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { NewsletterWidget, RecentResultsWidget } from "@/components/site/sidebar-widgets"

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "news", label: "News" },
  { key: "feature", label: "Features" },
  { key: "analysis", label: "Analysis" },
  { key: "interview", label: "Interviews" },
  { key: "opinion", label: "Opinion" },
]
const PAGE_SIZE = 10

function NewsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-16 w-24 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NewsView() {
  const [category, setCategory] = useState<string>("all")
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage] = useState(1)

  const apiCategory = category && category !== "all" ? category : undefined

  // Standard sidebar needs recent match results — fetch them at the view level.
  const { data: matchesData } = useMatches()

  // Debounce the search box. setState here is inside a timer callback (async),
  // so it doesn't trip the synchronous-setState-in-effect rule.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => clearTimeout(t)
  }, [q])

  const { data, loading } = useArticles({
    category: apiCategory,
    q: debouncedQ || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const articles = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  function selectCategory(c: string) {
    setCategory(c)
    goToPage(1)
  }
  function onSearch(v: string) {
    setQ(v)
    goToPage(1)
  }

  // Sync page with browser URL/history so the back button works across
  // pagination. Each page change pushes a history entry; popstate restores.
  function goToPage(p: number) {
    const clamped = Math.max(1, Math.min(totalPages || 1, p))
    setPage(clamped)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      if (clamped > 1) url.searchParams.set("page", String(clamped))
      else url.searchParams.delete("page")
      window.history.pushState(null, "", url)
    }
  }

  // On mount: read page from URL. Listen for back/forward to restore it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = parseInt(params.get("page") || "1", 10)
    if (p > 1) setPage(p)
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setPage(parseInt(params.get("page") || "1", 10))
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return (
    <InnerPageLayout
      header={
        /* Page header — h1 + subtitle + category pills + search box */
        <div className="space-y-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <Newspaper className="h-6 w-6 text-red-600" />
              News
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cricket news, features, analysis, interviews and opinion.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => selectCategory(c.key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors",
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                    aria-pressed={active}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search articles…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
        </div>
      }
      sidebar={
        <>
          <RecentResultsWidget matches={matchesData ?? []} />
          <CustomSidebarBlocks placement="article" />
          <NewsletterWidget />
        </>
      }
    >
      <div className="space-y-5">
        {loading ? (
          <NewsSkeleton />
        ) : articles.length === 0 ? (
          <Card className="grid min-h-[200px] place-items-center p-6">
            <p className="text-sm text-muted-foreground">
              {debouncedQ
                ? `No articles matching “${debouncedQ}”.`
                : "No articles in this category yet."}
            </p>
          </Card>
        ) : (
          <>
            {/* Article list — main column. Uses the rich default ArticleCard
                variant (16:9 thumbnail + excerpt + author + tags) in a
                2-column grid on desktop, single column on mobile. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {articles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {total} article{total !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </InnerPageLayout>
  )
}
