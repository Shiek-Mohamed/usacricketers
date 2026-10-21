import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeGallery } from "@/lib/serialize"
import { cacheWrap, cacheDelPrefix } from "@/lib/cache"
import { rateLimit } from "@/lib/rate-limit"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 120, windowMs: 60_000 })
  if (limited) return limited
  const result = await cacheWrap("galleries:list", async () => {
    const all = await db.gallery.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
    })
    return all.map(serializeGallery)
  }, 10_000)
  const res = NextResponse.json(result)
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  )
  return res
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  const g = await db.gallery.create({
    data: {
      title: body.title || "Untitled gallery",
      slug: body.slug || slugify(body.title || "gallery"),
      description: body.description || "",
      coverImage: body.coverImage || "",
      photos: typeof body.photos === "string" ? body.photos : JSON.stringify(body.photos || []),
      published: body.published !== false,
    },
  })
  cacheDelPrefix("galleries:list")
  return NextResponse.json(serializeGallery(g), { status: 201 })
}

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80)
}
