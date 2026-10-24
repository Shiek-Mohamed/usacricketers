import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheDelPrefix } from "@/lib/cache"

/**
 * POST /api/banners/[id]/click
 *
 * Image + HTML banner click-through. Increments the banner's click counter,
 * then returns the linkUrl so the client can navigate. (We can't use a 302
 * redirect for arbitrary HTML-banner clicks because the click might come from
 * a JS-triggered navigation; the client fetches this endpoint then navigates.)
 *
 * For image banners, the anchor's href IS this endpoint — the browser follows
 * the redirect naturally. For HTML banners, the admin needs to point the
 * banner's internal links at this endpoint manually if they want click
 * tracking; otherwise external links bypass us.
 *
 * AdSense banners: NOT applicable — Google tracks clicks inside their iframe.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const banner = await db.banner.findUnique({
    where: { id },
    select: { id: true, linkUrl: true },
  })
  if (!banner) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  // Increment the click counter. No admin guard — public endpoint (anyone
  // clicking the banner should be tracked). Rate-limiting / IP-based dedup
  // would be a future enhancement; for a CMS demo this is fine.
  await db.banner.update({
    where: { id },
    data: { clicks: { increment: 1 } },
  })
  cacheDelPrefix("banners:list")
  return NextResponse.json({
    linkUrl: banner.linkUrl ?? "#",
  })
}

/**
 * GET /api/banners/[id]/click — same as POST but as a 302 redirect, so an
 * `<a href="/api/banners/X/click">` works for image banners without JS.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const banner = await db.banner.findUnique({
    where: { id },
    select: { id: true, linkUrl: true },
  })
  if (!banner) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  // Fire-and-forget increment — don't block the redirect on it.
  db.banner
    .update({ where: { id }, data: { clicks: { increment: 1 } } })
    .then(() => cacheDelPrefix("banners:list"))
    .catch(() => {})
  const target = banner.linkUrl ?? null
  if (!target) {
    // No linkUrl configured — count the click + return a 204 No Content so
    // any client (e.g. an AdSense banner accidentally routed here) doesn't
    // navigate anywhere unexpected.
    return new NextResponse(null, { status: 204 })
  }
  // Next.js's NextResponse.redirect requires an absolute URL. Relative paths
  // would throw ERR_INVALID_URL. If the configured linkUrl is relative, make
  // it absolute using the request origin.
  const absolute = target.startsWith("http")
    ? target
    : new URL(target, _req.nextUrl.origin).toString()
  return NextResponse.redirect(absolute, { status: 302 })
}
