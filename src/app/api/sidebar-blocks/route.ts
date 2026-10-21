import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeSidebarBlock } from "@/lib/serialize"
import { cacheWrap, cacheDelPrefix } from "@/lib/cache"
import { rateLimit } from "@/lib/rate-limit"
import { requireSiteAdmin } from "@/lib/scorer-auth"

/**
 * A block matches a page type if its placement is "all" OR the page type is in
 * the comma-separated placement list.
 */
function matchesPlacement(placement: string, pageType: string): boolean {
  const p = (placement || "all").trim().toLowerCase()
  if (p === "all" || p === "") return true
  return p
    .split(",")
    .map((s) => s.trim())
    .includes(pageType)
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 120, windowMs: 60_000 })
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  // Only filter by placement when a page type is explicitly requested (public
  // sidebar). The admin list view sends no placement param → return all blocks.
  const placementParam = searchParams.get("placement")
  const includeDrafts = searchParams.get("drafts") === "true" // admin uses this

  const cacheKey = `sidebar-blocks:list:placement=${placementParam ?? "all"}:drafts=${includeDrafts}`
  const result = await cacheWrap(cacheKey, async () => {
    const all = await db.sidebarBlock.findMany({
      where: includeDrafts ? undefined : { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    })
    const items = placementParam
      ? all.filter((b) => matchesPlacement(b.placement, placementParam))
      : all
    return items.map(serializeSidebarBlock)
  }, 10_000)

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  const block = await db.sidebarBlock.create({
    data: {
      title: body.title || "Untitled",
      content: body.content || "",
      placement: body.placement || "all",
      order: Number(body.order ?? 0) || 0,
      published: body.published !== false,
    },
  })
  cacheDelPrefix("sidebar-blocks:list:")
  return NextResponse.json(serializeSidebarBlock(block), { status: 201 })
}
