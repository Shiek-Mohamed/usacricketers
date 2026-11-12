import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeGallery } from "@/lib/serialize"
import { cacheDelPrefix } from "@/lib/cache"
import { requireSiteAdmin } from "@/lib/scorer-auth"

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
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  const g = await db.gallery.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      description: body.description,
      coverImage: body.coverImage,
      photos: typeof body.photos === "string" ? body.photos : JSON.stringify(body.photos || []),
      // Allow updating createdAt for chronological reordering
      ...(body.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
      published: body.published !== false,
    },
  })
  cacheDelPrefix("galleries:list")
  return NextResponse.json(serializeGallery(g))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try { await db.gallery.delete({ where: { id } }) } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }) }
  cacheDelPrefix("galleries:list")
  return NextResponse.json({ ok: true })
}
