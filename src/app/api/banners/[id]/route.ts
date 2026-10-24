import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeBanner } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { cacheDelPrefix } from "@/lib/cache"

/** GET /api/banners/[id] — public (anyone can fetch a single banner's data). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const banner = await db.banner.findUnique({ where: { id } })
  if (!banner) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const res = NextResponse.json(serializeBanner(banner))
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  )
  return res
}

/** PUT /api/banners/[id] — site-admin only. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.type === "string" && ["image", "adsense", "html"].includes(body.type)) data.type = body.type
  if (typeof body.title === "string") data.title = body.title.trim()
  if (typeof body.placement === "string") data.placement = body.placement.trim()
  if (body.order !== undefined) data.order = Number(body.order) || 0
  if (body.published !== undefined) data.published = body.published !== false
  if (body.weight !== undefined) data.weight = Number(body.weight) || 1
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl ? String(body.imageUrl) : null
  if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl ? String(body.linkUrl) : null
  if (body.altText !== undefined) data.altText = body.altText ? String(body.altText) : null
  if (body.adsenseClient !== undefined) data.adsenseClient = body.adsenseClient ? String(body.adsenseClient) : null
  if (body.adsenseSlot !== undefined) data.adsenseSlot = body.adsenseSlot ? String(body.adsenseSlot) : null
  if (body.adsenseFormat !== undefined) data.adsenseFormat = body.adsenseFormat ? String(body.adsenseFormat) : null
  if (body.responsive !== undefined) data.responsive = body.responsive !== false
  if (body.htmlContent !== undefined) data.htmlContent = body.htmlContent ? String(body.htmlContent) : null

  const banner = await db.banner.update({ where: { id }, data })
  cacheDelPrefix("banners:list")
  return NextResponse.json(serializeBanner(banner))
}

/** DELETE /api/banners/[id] — site-admin only. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  await db.banner.delete({ where: { id } })
  cacheDelPrefix("banners:list")
  return NextResponse.json({ ok: true })
}
