import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeArticle } from "@/lib/serialize"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const slug = searchParams.get("slug")
  const featured = searchParams.get("featured")

  if (slug) {
    const article = await db.article.findUnique({ where: { slug } })
    if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(serializeArticle(article))
  }

  const articles = await db.article.findMany({
    where: {
      published: true,
      ...(category ? { category } : {}),
      ...(featured === "true" ? { featured: true } : {}),
    },
    orderBy: { publishedAt: "desc" },
  })
  return NextResponse.json(articles.map(serializeArticle))
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
  return NextResponse.json(serializeArticle(article), { status: 201 })
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}
