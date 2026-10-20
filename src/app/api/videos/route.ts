import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeVideo } from "@/lib/serialize"
import { extractYouTubeId, youTubeEmbedUrl, youTubeThumb } from "@/lib/youtube"

export const dynamic = "force-dynamic"

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category") || undefined
  const featured = searchParams.get("featured") === "true"
  const drafts = searchParams.get("drafts") === "true"
  const limitRaw = Number(searchParams.get("limit") || "0")
  const limit = limitRaw > 0 ? Math.min(100, limitRaw) : undefined

  const where: Record<string, unknown> = {}
  if (!drafts) where.published = true
  if (category) where.category = category
  if (featured) where.featured = true

  const videos = await db.video.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  })
  return NextResponse.json(videos.map(serializeVideo))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const title = String(body.title || "").trim()
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })

    const source = body.source === "upload" ? "upload" : "youtube"
    let videoUrl = String(body.videoUrl || "").trim()
    let youtubeId = ""
    let thumbnailUrl = String(body.thumbnailUrl || "").trim()

    if (source === "youtube") {
      youtubeId = extractYouTubeId(videoUrl)
      if (!youtubeId)
        return NextResponse.json(
          { error: "Could not extract a YouTube video ID from the URL" },
          { status: 400 }
        )
      videoUrl = youTubeEmbedUrl(youtubeId)
      if (!thumbnailUrl) thumbnailUrl = youTubeThumb(youtubeId)
    }

    const base = slugify(title)
    let slug = base || `video-${Date.now()}`
    let n = 1
    while (await db.video.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`
    }

    const created = await db.video.create({
      data: {
        title,
        slug,
        description: String(body.description || ""),
        source,
        videoUrl,
        youtubeId,
        thumbnailUrl,
        duration: String(body.duration || ""),
        category: String(body.category || "Highlights"),
        author: String(body.author || "USA Cricketers"),
        tags: String(body.tags || ""),
        featured: !!body.featured,
        published: body.published !== false,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
      },
    })
    return NextResponse.json(serializeVideo(created))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
