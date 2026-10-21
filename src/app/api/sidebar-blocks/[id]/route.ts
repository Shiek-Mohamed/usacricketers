import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeSidebarBlock } from "@/lib/serialize"
import { cacheDelPrefix } from "@/lib/cache"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const block = await db.sidebarBlock.findUnique({ where: { id } })
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeSidebarBlock(block))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  const block = await db.sidebarBlock.update({
    where: { id },
    data: {
      title: body.title,
      content: body.content,
      placement: body.placement,
      order: Number(body.order) || 0,
      published: body.published !== false,
    },
  })
  cacheDelPrefix("sidebar-blocks:list:")
  return NextResponse.json(serializeSidebarBlock(block))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    await db.sidebarBlock.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  cacheDelPrefix("sidebar-blocks:list:")
  return NextResponse.json({ ok: true })
}
