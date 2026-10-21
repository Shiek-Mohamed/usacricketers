import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeArticle } from "@/lib/serialize"
import { cacheDelPrefix } from "@/lib/cache"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const article = await db.article.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeArticle(article))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  const article = await db.article.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt,
      content: body.content,
      imageUrl: body.imageUrl || null,
      imageCaption: body.imageCaption ?? null,
      category: body.category,
      author: body.author,
      tags: body.tags,
      featured: !!body.featured,
      published: body.published !== false,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
    },
  })
  cacheDelPrefix("articles:list:")
  return NextResponse.json(serializeArticle(article))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    await db.article.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  cacheDelPrefix("articles:list:")
  return NextResponse.json({ ok: true })
}
