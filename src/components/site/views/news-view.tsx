"use client"

import { useMemo, useState } from "react"
import { useArticles } from "@/lib/use-data"
import { ArticleCard } from "@/components/cricket/article-card"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TrendingUp, Newspaper, Flame } from "lucide-react"

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "news", label: "News" },
  { key: "feature", label: "Features" },
  { key: "analysis", label: "Analysis" },
  { key: "interview", label: "Interviews" },
  { key: "opinion", label: "Opinion" },
]

function NewsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
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
      <div className="lg:col-span-1 space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function NewsView() {
  const [category, setCategory] = useState<string>("all")
  // "all" maps to undefined (no category filter)
  const apiCategory = category && category !== "all" ? category : undefined
  const { data, loading } = useArticles({
    category: apiCategory,
  })

  const articles = data ?? []
  const mostRead = useMemo(() => articles.slice(0, 5), [articles])
  const topStories = useMemo(() => articles.slice(0, 4), [articles])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Newspaper className="h-6 w-6 text-red-600" />
          News
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cricket news, features, analysis, interviews and opinion.
        </p>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => {
          const active = category === c.key
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
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

      {loading ? (
        <NewsSkeleton />
      ) : articles.length === 0 ? (
        <Card className="grid min-h-[200px] place-items-center p-6">
          <p className="text-sm text-muted-foreground">
            No articles in this category yet.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">
            {articles.map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                variant="horizontal"
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
                  <Flame className="h-4 w-4 text-red-600" />
                  Most Read
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ol className="space-y-3">
                  {mostRead.map((a, i) => (
                    <li key={a.id} className="flex items-start gap-2">
                      <span className="text-base font-extrabold text-muted-foreground/40">
                        {i + 1}
                      </span>
                      <ArticleCard article={a} variant="compact" />
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Top Stories
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="space-y-3">
                  {topStories.map((a) => (
                    <ArticleCard key={a.id} article={a} variant="compact" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
