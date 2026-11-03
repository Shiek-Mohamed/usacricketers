import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { db } from "@/lib/db"
import { serializeArticle } from "@/lib/serialize"
import type { Prisma } from "@prisma/client"
import type { Article } from "@/lib/types"
import { ArticlePageContent } from "./ArticlePageContent"

// Always render fresh — article content can be edited at any time.
export const dynamic = "force-dynamic"

/**
 * Fetch an article by slug with a defensive raw-SQL fallback.
 *
 * Some historical rows in the SQLite DB have `publishedAt` / `createdAt` /
 * `updatedAt` stored as integer Unix-ms timestamps rather than ISO strings.
 * When Prisma's typed `findUnique` reads these it can throw (the DateTime
 * client expects a Date/ISO string, not a number). The fallback re-runs the
 * query as raw SQL and coerces numeric timestamps back into Date objects so
 * `serializeArticle` can safely call `.toISOString()` on them.
 */
async function fetchArticleBySlug(slug: string) {
  try {
    const article = await db.article.findUnique({ where: { slug } })
    return article
  } catch (err) {
    console.warn("[news/[slug]] findUnique failed, trying raw SQL:", err)
    try {
      // SQLite table name is quoted because Prisma creates it case-sensitively.
      // `?` placeholder is param-bound by Prisma's driver — no SQL-injection risk.
      const rows = (await db.$queryRawUnsafe<
        Array<{
          id: string
          title: string
          slug: string
          excerpt: string
          content: string
          imageUrl: string | null
          imageCaption: string | null
          category: string
          author: string
          tags: string
          featured: number | boolean
          published: number | boolean
          publishedAt: Date | number | string
          createdAt: Date | number | string
          updatedAt: Date | number | string
        }>
      >)(`SELECT * FROM "Article" WHERE slug = ? LIMIT 1`, slug)

      const row = rows[0]
      if (!row) return null

      // Coerce numeric timestamps back into Date objects.
      const toDate = (v: Date | number | string): Date =>
        v instanceof Date ? v : new Date(typeof v === "number" ? v : Date.parse(v))

      return {
        ...row,
        featured: !!row.featured,
        published: !!row.published,
        publishedAt: toDate(row.publishedAt),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      } as Prisma.ArticleGetPayload<Record<string, never>>
    } catch (rawErr) {
      console.error("[news/[slug]] raw SQL fallback failed:", rawErr)
      return null
    }
  }
}

// Build absolute OG image URL: prefer the article's own image, fall back to
// the dynamic /api/og-image generator.
function ogImageUrl(article: Article, slug: string): string | undefined {
  if (article.imageUrl) return article.imageUrl
  const base = process.env.NEXT_PUBLIC_BASE_URL || ""
  return base ? `${base}/api/og-image?article=${article.id}` : undefined
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await fetchArticleBySlug(slug)
  if (!article) {
    return { title: "Article not found — USACricketers" }
  }
  const serialized = serializeArticle(article)

  return {
    title: `${serialized.title} — USACricketers`,
    description: serialized.excerpt,
    keywords: serialized.tags
      ? serialized.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined,
    openGraph: {
      title: serialized.title,
      description: serialized.excerpt,
      images: ogImageUrl(serialized, slug) ? [ogImageUrl(serialized, slug)!] : [],
      type: "article",
      publishedTime: serialized.publishedAt,
      modifiedTime: serialized.updatedAt,
      authors: [serialized.author],
      url: `/news/${slug}`,
    },
    alternates: { canonical: `/news/${slug}` },
    twitter: {
      card: serialized.imageUrl ? "summary_large_image" : "summary",
      title: serialized.title,
      description: serialized.excerpt,
      images: serialized.imageUrl ? [serialized.imageUrl] : [],
    },
  }
}

/**
 * Pre-render the most recent published article slugs at build time so Google
 * sees the content with zero server roundtrip. Older articles are rendered
 * on-demand (and cached) by `dynamic = "force-dynamic"`.
 *
 * Failures are swallowed — at build time the SQLite file may not exist
 * (Docker build container), in which case we skip pre-rendering entirely.
 */
export async function generateStaticParams() {
  try {
    const articles = await db.article.findMany({
      where: { published: true },
      select: { slug: true },
      orderBy: { publishedAt: "desc" },
      take: 50,
    })
    return articles.map((a) => ({ slug: a.slug }))
  } catch {
    return []
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = await fetchArticleBySlug(slug)
  if (!article) notFound()

  const serialized = serializeArticle(article)

  // Related articles: same category, excluding the current article. Wrapped
  // in try/catch for the same DateTime-bug reason — if the findMany fails we
  // just render the page without a "Read Next" section.
  //
  // We select all columns (no `select:` clause) so the rows match the full
  // Prisma Article shape that `serializeArticle` expects.
  let relatedRows: Array<Prisma.ArticleGetPayload<Record<string, never>>> = []
  try {
    relatedRows = await db.article.findMany({
      where: {
        published: true,
        slug: { not: slug },
        category: { contains: article.category },
        publishedAt: { lte: new Date() },
      },
      orderBy: { publishedAt: "desc" },
      take: 4,
    })
  } catch (err) {
    console.warn("[news/[slug]] related findMany failed:", err)
  }

  const related: Article[] = relatedRows.map((r) => serializeArticle(r))

  // NewsArticle JSON-LD structured data — rendered server-side so search
  // engines see it in the initial HTML response.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: serialized.title,
    description: serialized.excerpt,
    image: serialized.imageUrl ? [serialized.imageUrl] : undefined,
    datePublished: serialized.publishedAt,
    dateModified: serialized.updatedAt,
    author: { "@type": "Person", name: serialized.author },
    publisher: { "@type": "Organization", name: "USACricketers" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `/news/${slug}`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticlePageContent article={serialized} related={related} />
    </>
  )
}
