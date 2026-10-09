import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeArticle } from "@/lib/serialize"
import { cacheWrap, cacheDelPrefix } from "@/lib/cache"
import { rateLimit } from "@/lib/rate-limit"
import type { Prisma } from "@prisma/client"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const LIST_TTL = 10_000 // 10s — short so fresh posts appear quickly

function parsePagination(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE)
  )
  const category = searchParams.get("category") || undefined
  const featured = searchParams.get("featured") === "true" ? true : undefined
  const q = searchParams.get("q")?.trim() || undefined
  return { page, pageSize, category, featured, q }
}

export async function GET(req: NextRequest) {
  // Rate limit (public list endpoint)
  const limited = rateLimit(req, { limit: 120, windowMs: 60_000 })
  if (limited) return limited

  // Single-article-by-slug lookup (used by the public article detail page)
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get("slug")
  if (slug) {
    const article = await db.article.findUnique({ where: { slug } })
    if (!article)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(serializeArticle(article))
  }

  const { page, pageSize, category, featured, q } = parsePagination(req)

  const where: Prisma.ArticleWhereInput = { published: true }
  if (category) where.category = category
  if (featured) where.featured = true
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { excerpt: { contains: q } },
      { content: { contains: q } },
      { tags: { contains: q } },
    ]
  }

  // Cache the page result so repeated list loads don't re-hit the DB.
  const cacheKey = `articles:list:p=${page}:s=${pageSize}:c=${category ?? ""}:f=${featured ? 1 : 0}:q=${q ?? ""}`
  const result = await cacheWrap(cacheKey, async () => {
    const [items, total] = await Promise.all([
      db.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.article.count({ where }),
    ])
    return {
      items: items.map(serializeArticle),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }, LIST_TTL)

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const slug = body.slug || slugify(body.title)
  const article = await db.article.create({
    data: {
      title: body.title,
      slug,
      excerpt: body.excerpt || "",
      content: body.content || "",
      imageUrl: body.imageUrl || null,
      category: body.category || "news",
      author: body.author || "ESPNcricinfo staff",
      tags: body.tags || "",
      featured: !!body.featured,
      published: body.published !== false,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
    },
  })
  // Invalidate cached list pages so the new post appears immediately.
  cacheDelPrefix("articles:list:")
  return NextResponse.json(serializeArticle(article), { status: 201 })
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}
