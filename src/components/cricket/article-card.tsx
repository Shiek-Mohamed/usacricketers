"use client"

import type { Article } from "@/lib/types"
import { formatDate, timeAgo } from "@/components/cricket/ui"
import { Card } from "@/components/ui/card"
import { Newspaper, User, Clock, Timer } from "lucide-react"
import { SmartImage } from "@/components/site/smart-image"

/**
 * Article card — used across the site (home, news listing, article sidebars,
 * "Read Next" grids, etc.).
 *
 * Cards render as `<a href="/news/${article.slug}">` tags so they deep-link
 * directly to the SSR article page (no SPA navigation needed — the link
 * triggers a full page load which is what we want for SEO + shareability).
 *
 * The original SPA flow (`?view=article-detail&id=xxx`) still works for any
 * legacy links, but every card UI now prefers the clean `/news/<slug>` URL.
 */

/**
 * Reading-time estimate (200 wpm). Defensive: only returns a value when the
 * article actually carries a `content` string — list views sometimes only have
 * the excerpt, in which case the caller should skip the label entirely.
 */
function getReadTime(article: Article): number | null {
  const content = (article as Partial<Article>).content
  if (typeof content !== "string" || !content.trim()) return null
  const words = content.trim().split(/\s+/).filter(Boolean).length
  if (!words) return null
  return Math.max(1, Math.ceil(words / 200))
}

/**
 * Build the article's canonical URL. Falls back to the legacy SPA URL when
 * the article has no slug (defensive — should never happen since `slug` is
 * `@unique` in the schema, but keeps the card clickable if a row was
 * inserted directly into the DB without one).
 */
function articleHref(article: Article): string {
  return article.slug ? `/news/${article.slug}` : `/?view=article-detail&id=${article.id}`
}

export function ArticleCard({
  article,
  variant = "default",
  showCategory = true,
  showTags = true,
}: {
  article: Article
  variant?: "default" | "featured" | "compact" | "horizontal"
  /** Show the category badge (e.g., "NEWS") on the card. Default: true */
  showCategory?: boolean
  /** Show keyword tag chips below the excerpt. Default: true */
  showTags?: boolean
}) {
  const readMinutes = getReadTime(article)
  const href = articleHref(article)

  if (variant === "compact") {
    return (
      <a
        href={href}
        className="flex w-full items-start gap-2 text-left group"
      >
        <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase text-primary">
          {article.categories[0]}
        </span>
        <span className="text-sm leading-snug font-medium group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </span>
      </a>
    )
  }

  if (variant === "horizontal") {
    return (
      <a
        href={href}
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
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">{article.author}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{formatDate(article.publishedAt)}</span>
            {readMinutes && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                  <Timer className="h-2.5 w-2.5" aria-hidden="true" />
                  {readMinutes} min
                </span>
              </>
            )}
          </div>
        </div>
      </a>
    )
  }

  if (variant === "featured") {
    return (
      <a
        href={href}
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
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{article.author}</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">{timeAgo(article.publishedAt)}</span>
          {readMinutes && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                <Timer className="h-2.5 w-2.5" aria-hidden="true" />
                {readMinutes} min read
              </span>
            </>
          )}
        </div>
      </a>
    )
  }

  // default — the 16:9 thumbnail card used in news listing, home, "Read Next".
  return (
    <Card className="group cursor-pointer overflow-hidden p-0 transition-all hover:shadow-md hover:border-foreground/20">
      <a
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`${article.categories[0] ?? "Article"}: ${article.title}`}
      >
        {/* Thumbnail: 16:9 with real image when available, Newspaper icon fallback.
            Uses next/image (via SmartImage) for automatic WebP/AVIF conversion,
            responsive srcset, + lazy-loading. Falls back to the Newspaper icon
            when imageUrl is missing OR when the image fails to load. */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {article.imageUrl ? (
            <SmartImage
              src={article.imageUrl}
              alt={article.imageCaption || article.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Newspaper className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
          {/* Category badge overlaid on thumbnail — hidden when showCategory=false */}
          {showCategory && article.categories[0] && (
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
            {readMinutes && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap"
                  title={`About ${readMinutes} min read`}
                >
                  <Timer className="h-3 w-3" aria-hidden="true" />
                  {readMinutes} min read
                </span>
              </>
            )}
          </div>
          {showTags && article.tags && (
            <div className="flex flex-wrap gap-1 pt-1">
              {article.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 3)
                .map((tag, i) => (
                  <span
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (typeof window !== "undefined") {
                        window.location.href = `/?view=news&tag=${encodeURIComponent(tag)}`
                      }
                    }}
                    className="cursor-pointer rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-400"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          )}
        </div>
      </a>
    </Card>
  )
}
