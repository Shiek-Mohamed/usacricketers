"use client"

import type { Article } from "@/lib/types"
import { useAppStore } from "@/lib/store"
import { timeAgo } from "@/components/cricket/ui"
import { cn } from "@/lib/utils"
import { Newspaper } from "lucide-react"

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
          {article.category}
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
            {article.category}
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {article.author} · {timeAgo(article.publishedAt)}
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
              {article.category}
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
    <button
      onClick={() => navigate("article-detail", article.id)}
      className="group block w-full text-left"
    >
      <div className="grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
        <Newspaper className="h-8 w-8" />
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase text-primary">
        {article.category}
      </div>
      <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
        {article.title}
      </h3>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {timeAgo(article.publishedAt)}
      </div>
    </button>
  )
}
