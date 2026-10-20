import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeVideo } from "@/lib/serialize"
import { extractYouTubeId, youTubeEmbedUrl, youTubeThumb } from "@/lib/youtube"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const v = await db.video.findUnique({ where: { id } })
  if (!v) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(serializeVideo(v))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const existing = await db.video.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 })
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title)
    if (body.description !== undefined) data.description = String(body.description)
    if (body.category !== undefined) data.category = String(body.category)
    if (body.author !== undefined) data.author = String(body.author)
    if (body.tags !== undefined) data.tags = String(body.tags)
    if (body.duration !== undefined) data.duration = String(body.duration)
    if (body.featured !== undefined) data.featured = !!body.featured
    if (body.published !== undefined) data.published = !!body.published
    if (body.thumbnailUrl !== undefined) data.thumbnailUrl = String(body.thumbnailUrl)
    if (body.publishedAt !== undefined) data.publishedAt = new Date(body.publishedAt)

    // Re-derive source/videoUrl/youtubeId/thumbnailUrl if source or videoUrl changed.
    const source = body.source === "upload" ? "upload" : body.source === "youtube" ? "youtube" : undefined
    if (source) data.source = source
    if (body.videoUrl !== undefined) {
      const url = String(body.videoUrl)
      const finalSource = (data.source as string) || existing.source
      if (finalSource === "youtube") {
        const yId = extractYouTubeId(url)
        if (yId) {
          data.videoUrl = youTubeEmbedUrl(yId)
          data.youtubeId = yId
          if (!body.thumbnailUrl) data.thumbnailUrl = youTubeThumb(yId)
        } else {
          data.videoUrl = url
        }
      } else {
        // upload — keep the local path as-is
        data.videoUrl = url
      }
    }

    const updated = await db.video.update({ where: { id }, data })
    return NextResponse.json(serializeVideo(updated))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await db.video.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
