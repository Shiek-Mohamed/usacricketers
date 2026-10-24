import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheDelPrefix } from "@/lib/cache"

/**
 * POST /api/banners/[id]/impression
 *
 * Fire-and-forget impression ping from the client when a banner scrolls into
 * view (via IntersectionObserver in the BannerSlot component). Increments the
 * impressions counter. No admin guard (public — every viewer should count).
 *
 * AdSense caveat: this counts "the slot was rendered" — AdSense may not
 * actually fill the slot, so the number won't match AdSense's dashboard.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const banner = await db.banner.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!banner) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  await db.banner.update({
    where: { id },
    data: { impressions: { increment: 1 } },
  })
  cacheDelPrefix("banners:list")
  return NextResponse.json({ ok: true })
}
