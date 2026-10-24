import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeBanner } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"

/**
 * GET /api/banners
 *
 * Public list endpoint — returns banners filtered by:
 *   • `placement` query param (the slot identifier, e.g. "home-live-hero")
 *   • `published === true`
 *   • date-active (startDate <= now <= endDate, or null startDate/endDate)
 *
 * Returns ALL active banners for that slot — the client picks one + rotates
 * as needed (sidesteps the CDN caching issue with server-side rotation).
 *
 * Query params:
 *   • placement (string) — required for the public filtered list
 *   • all=1 (any value) — admin-only: returns ALL banners (incl. drafts +
 *     expired), ignoring placement + date filtering. Requires site-admin
 *     cookie.
 *
 * Cache: 60s s-maxage + 5min stale-while-revalidate on the public filtered
 * path (CDN-friendly). The admin `all=1` path is no-cache (admin needs
 * up-to-the-minute data when managing).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const all = searchParams.get("all")
  const placement = searchParams.get("placement")

  // Admin-only: list everything (for the admin table view).
  if (all) {
    const admin = requireSiteAdmin(req)
    if (!admin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
    const banners = await db.banner.findMany({
      orderBy: [{ placement: "asc" }, { order: "asc" }, { createdAt: "desc" }],
    })
    return NextResponse.json(banners.map(serializeBanner), {
      headers: { "Cache-Control": "no-store" },
    })
  }

  // Public filtered list.
  if (!placement) {
    return NextResponse.json([])
  }
  const now = new Date()
  const banners = await db.banner.findMany({
    where: {
      published: true,
      placement,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  })
  const res = NextResponse.json(banners.map(serializeBanner))
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  )
  return res
}

/**
 * POST /api/banners — site-admin only. Creates a new banner.
 *
 * Body: { type, title, placement, order?, published?, startDate?, endDate?,
 *         weight?, imageUrl?, linkUrl?, altText?, adsenseClient?,
 *         adsenseSlot?, adsenseFormat?, responsive?, htmlContent? }
 */
export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const type = (body.type as string) || "image"
  if (!["image", "adsense", "html"].includes(type)) {
    return NextResponse.json(
      { error: `Invalid banner type: ${type}` },
      { status: 400 }
    )
  }
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const banner = await db.banner.create({
    data: {
      type,
      title: String(body.title).trim(),
      placement: String(body.placement || "home-live-hero").trim(),
      order: Number(body.order ?? 0) || 0,
      published: body.published !== false,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      weight: Number(body.weight ?? 1) || 1,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      linkUrl: body.linkUrl ? String(body.linkUrl) : null,
      altText: body.altText ? String(body.altText) : null,
      adsenseClient: body.adsenseClient ? String(body.adsenseClient) : null,
      adsenseSlot: body.adsenseSlot ? String(body.adsenseSlot) : null,
      adsenseFormat: body.adsenseFormat ? String(body.adsenseFormat) : null,
      responsive: body.responsive !== false,
      htmlContent: body.htmlContent ? String(body.htmlContent) : null,
    },
  })
  return NextResponse.json(serializeBanner(banner), { status: 201 })
}
