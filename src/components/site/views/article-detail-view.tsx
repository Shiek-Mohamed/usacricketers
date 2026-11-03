"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { useAppStore } from "@/lib/store"
import { useArticle, useArticles } from "@/lib/use-data"
import type { Article } from "@/lib/types"
import { formatDate } from "@/components/cricket/ui"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { ShareButtons } from "@/components/site/share-buttons"
import { SeoMeta } from "@/components/site/seo-meta"
import { ArticleCard } from "@/components/cricket/article-card"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import {
  ArticleListWidget,
  NewsletterWidget,
} from "@/components/site/sidebar-widgets"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Clock,
  User,
  Info,
  ArrowLeft,
  Home as HomeIcon,
} from "lucide-react"

function estimateReadTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  if (!words) return 1
  return Math.max(1, Math.round(words / 200))
}

function ArticleHeroImage({
  url,
  caption,
}: {
  url: string | null
  caption?: string | null
}) {
  const hasCaption = !!caption && caption.trim().length > 0
  if (url) {
    return (
      <figure className="w-full">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-lg">
          {/* next/image not used to keep this a runtime-only image */}
          <img src={url} alt={caption ?? ""} className="block h-full w-full object-cover" />
        </div>
        {hasCaption && (
          <figcaption className="mt-1 text-sm font-semibold leading-[1.525] text-foreground">
            <span>{caption}</span>
          </figcaption>
        )}
      </figure>
    )
  }
  return (
    <div className="grid aspect-[16/9] w-full place-items-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-slate-300">
      <Newspaper className="h-12 w-12" />
    </div>
  )
}

function ArticleMarkdown({ content }: { content: string }) {
  return (
    <div className="text-foreground">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-2xl font-extrabold leading-tight sm:text-3xl">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 text-xl font-bold leading-tight sm:text-2xl">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-lg font-bold leading-tight sm:text-xl">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-4 mb-2 text-base font-semibold leading-tight">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-foreground/90">
              {children}
            </p>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-red-600 underline underline-offset-2 hover:text-red-700"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-5 list-disc space-y-1.5 leading-relaxed">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-5 list-decimal space-y-1.5 leading-relaxed">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-4 border-primary pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          img: ({ src, alt }) => {
            const caption = alt && alt.trim() ? alt : ""
            return (
              <figure className="my-6">
                {/* next/image not used to keep this a runtime-only image */}
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={caption}
                  className="block w-full rounded-lg"
                />
                {caption ? (
                  <figcaption className="mt-1 text-sm font-semibold leading-[1.525] text-foreground">
                    <span>{caption}</span>
                  </figcaption>
                ) : null}
              </figure>
            )
          },
        }}
        rehypePlugins={[rehypeRaw]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function ArticleDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="aspect-[16/9] w-full rounded-lg" />
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * Breadcrumb nav: Home > News > [Article title].
 *
 * Uses plain `<a>` tags → full page navigation. Home → `/` (SPA home view),
 * News → `/news` (which 301-redirects to the SPA news listing `/?view=news`).
 *
 * The SPA `navigate()` flow is intentionally avoided here so the breadcrumbs
 * produce shareable clean URLs that match the SSR article pages.
 */
function ArticleBreadcrumbs({ title }: { title: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
    >
      <a
        href="/"
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <HomeIcon className="h-3 w-3" />
        Home
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <a
        href="/news"
        className="transition-colors hover:text-foreground"
      >
        News
      </a>
      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <span className="line-clamp-1 max-w-[60%] truncate font-medium text-foreground/80">
        {title}
      </span>
    </nav>
  )
}

export function ArticleDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data, loading, error } = useArticle(id)
  const { data: articlesPage } = useArticles({ pageSize: 10 })

  // Category-filtered "Read Next" list — fetched once we know the article's
  // primary category. Falls back to [] while the article is loading or when
  // the article has no categories.
  const primaryCategory = data?.categories?.[0]
  const { data: relatedPage } = useArticles(
    primaryCategory ? { category: primaryCategory, pageSize: 5 } : undefined,
  )

  const content = data?.content ?? ""
  const readTime = useMemo(() => estimateReadTime(content), [content])
  const related = useMemo(() => {
    const items = articlesPage?.items ?? []
    return items
      .filter((a) => a.id !== id)
      .slice(0, 4)
  }, [articlesPage, id])
  const readNext = useMemo(() => {
    const items = relatedPage?.items ?? []
    return items
      .filter((a) => a.id !== id)
      .slice(0, 4)
  }, [relatedPage, id])

  if (loading) return <ArticleDetailSkeleton />

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("news")}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to news
        </Button>
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Unable to load article</AlertTitle>
          <AlertDescription>
            {error || "Article not found. It may have been removed."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const article: Article = data
  const tags = article.tags
    ? article.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  // SEO meta tags (OG, Twitter cards, schema.org JSON-LD)
  const seoUrl = typeof window !== "undefined"
    ? `${window.location.origin}/?view=article-detail&id=${article.id}`
    : undefined

  return (
    <>
    <SeoMeta
      title={article.title}
      description={article.excerpt}
      image={article.imageUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/api/og-image?article=${article.id}`}
      url={seoUrl}
      type="article"
      publishedTime={article.publishedAt}
      author={article.author}
      keywords={tags}
    />
    <InnerPageLayout
      mainWidth={600}
      header={
        <>
          <ArticleBreadcrumbs title={article.title} />

          <article className="space-y-4">
            {/* Hero header + large image render full-width above the sidebar */}
            <header className="space-y-3">
              <Badge className="bg-primary text-primary-foreground">
                {article.categories[0]}
              </Badge>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                {article.title}
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                {article.excerpt}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {article.author}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(article.publishedAt)}
                </span>
                <span className="inline-flex items-center gap-1" title={`About ${readTime} min read`}>
                  <Clock className="h-3.5 w-3.5" />
                  {readTime} min read
                </span>
              </div>
              <div className="mt-2">
                <ShareButtons title={article.title} />
              </div>
            </header>

            <ArticleHeroImage url={article.imageUrl} caption={article.imageCaption} />
          </article>
        </>
      }
      sidebar={
        <>
          {related.length > 0 && (
            <ArticleListWidget title="Related Stories" articles={related} />
          )}
          <NewsletterWidget />
          <CustomSidebarBlocks placement="article" />
        </>
      }
    >
      <div className="space-y-4">
        {/* Content — begins below the large image */}
        <div className="max-w-none">
          <ArticleMarkdown content={article.content} />
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-xs font-semibold text-muted-foreground">
              Tags:
            </span>
            {tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("news")}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> More news
        </Button>
      </div>
    </InnerPageLayout>

    {/* Read Next — grid of related ArticleCards from the same category,
        rendered full-width below the article + sidebar layout. */}
    {readNext.length > 0 && (
      <section
        aria-label="Read next"
        className="mt-10 border-t pt-6"
      >
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold sm:text-xl">
          <Newspaper className="h-5 w-5 text-primary" />
          Read Next
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {readNext.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </section>
    )}
    </>
  )
}
