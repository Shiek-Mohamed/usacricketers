"use client"

import { useEffect, useMemo, useState } from "react"
import { useArticles, useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { ArticleCard } from "@/components/cricket/article-card"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Search, ChevronLeft, ChevronRight, Mic } from "lucide-react"
import type { Article } from "@/lib/types"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { NewsletterWidget, RecentResultsWidget } from "@/components/site/sidebar-widgets"

const PAGE_SIZE = 9

function InterviewsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[16/9] w-full rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function InterviewsView() {
  const navigate = useAppStore((s) => s.navigate)
  const { data: matchesData } = useMatches()
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => clearTimeout(t)
  }, [q])

  const { data, loading } = useArticles({
    category: "interview",
    q: debouncedQ || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const { data: featured } = useArticles({ category: "interview", pageSize: 5 })

  const articles = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0
  // `topInterviews` powers the in-body "Popular Interviews" strip below the
  // article grid. The standard sidebar (RecentResultsWidget etc.) pulls
  // from `matchesData` (match fixtures) — see the sidebar composition below.
  const topInterviews = featured?.items ?? []

  return (
    <InnerPageLayout
      header={
        <div className="space-y-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <Mic className="h-6 w-6 text-red-600" />
              Interviews
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              In-depth conversations with the game&apos;s biggest stars.
            </p>
          </div>
          <div className="flex justify-end">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                placeholder="Search interviews…"
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
          <InterviewsSkeleton />
        ) : articles.length === 0 ? (
          <Card className="grid min-h-[200px] place-items-center p-6">
            <p className="text-sm text-muted-foreground">
              {debouncedQ
                ? `No interviews matching “${debouncedQ}”.`
                : "No interviews published yet."}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <ArticleCard key={a.id} article={a} variant="default" />
              ))}
            </div>

            {/* Popular Interviews sidebar-style strip */}
            {topInterviews.length > 0 && (
              <div className="mt-6 rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-red-600" />
                  <h2 className="text-sm font-extrabold uppercase tracking-tight">
                    Popular Interviews
                  </h2>
                </div>
                <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {topInterviews.map((a, i) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-extrabold text-muted-foreground">
                        {i + 1}
                      </span>
                      <ArticleCard article={a} variant="compact" />
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {total} interview
                  {total !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
