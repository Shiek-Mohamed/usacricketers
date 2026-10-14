import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeGallery } from "@/lib/serialize"
import { cacheDelPrefix } from "@/lib/cache"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const g = await db.gallery.findUnique({ where: { id } })
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeGallery(g))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const g = await db.gallery.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      description: body.description,
      coverImage: body.coverImage,
      photos: typeof body.photos === "string" ? body.photos : JSON.stringify(body.photos || []),
      published: body.published !== false,
    },
  })
  cacheDelPrefix("galleries:list")
  return NextResponse.json(serializeGallery(g))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try { await db.gallery.delete({ where: { id } }) } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }) }
  cacheDelPrefix("galleries:list")
  return NextResponse.json({ ok: true })
}
