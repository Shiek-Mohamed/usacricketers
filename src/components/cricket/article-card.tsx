"use client"

import type { Article } from "@/lib/types"
import { useAppStore } from "@/lib/store"
import { formatDate } from "@/components/cricket/ui"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Newspaper, User, Clock } from "lucide-react"

export function ArticleCard({
  article,
  variant = "default",
}: {
  article: Article
  variant?: "default" | "featured" | "compact" | "horizontal"
}) {
  const navigate = useAppStore((s) => s.navigate)

  if (variant === "compact") {
    return (
      <button
        onClick={() => navigate("article-detail", article.id)}
        className="flex w-full items-start gap-2 text-left group"
      >
        <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase text-primary">
          {article.categories[0]}
        </span>
        <span className="text-sm leading-snug font-medium group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </span>
      </button>
    )
  }

  if (variant === "horizontal") {
    return (
      <button
        onClick={() => navigate("article-detail", article.id)}
        className="flex w-full items-start gap-3 text-left group"
      >
        <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Newspaper className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase text-primary">
            {article.categories[0]}
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {article.author} · {formatDate(article.publishedAt)}
          </div>
        </div>
      </button>
    )
  }

  if (variant === "featured") {
    return (
      <button
        onClick={() => navigate("article-detail", article.id)}
        className="group block w-full text-left"
      >
        <div className="relative grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-slate-300">
          <Newspaper className="h-10 w-10" />
          <div className="absolute left-3 top-3">
            <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              {article.categories[0]}
            </span>
          </div>
        </div>
        <h2 className="mt-2 line-clamp-3 text-lg font-bold leading-tight group-hover:text-primary transition-colors sm:text-xl">
          {article.title}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {article.excerpt}
        </p>
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          {article.author} · {timeAgo(article.publishedAt)}
        </div>
      </button>
    )
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${article.categories[0] ?? "Article"}: ${article.title}`}
      onClick={() => navigate("article-detail", article.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          navigate("article-detail", article.id)
        }
      }}
      className="group cursor-pointer overflow-hidden p-0 transition-all hover:shadow-md hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {/* Thumbnail: 16:9 with real image when available, Newspaper icon fallback */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt={article.imageCaption || article.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <Newspaper className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
        {/* Category badge overlaid on thumbnail */}
        {article.categories[0] && (
          <div className="absolute left-2 top-2">
            <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              {article.categories[0]}
            </span>
          </div>
        )}
      </div>

      {/* Body: title + excerpt + meta + tags */}
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1">
            <User className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{article.author}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDate(article.publishedAt)}
          </span>
        </div>
        {article.tags && (
          <div className="flex flex-wrap gap-1 pt-1">
            {article.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 3)
              .map((tag, i) => (
                <span
                  key={i}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
          </div>
        )}
      </div>
    </Card>
  )
}
