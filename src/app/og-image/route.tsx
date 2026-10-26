import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ImageResponse } from "next/og"

export const runtime = "edge"

/**
 * GET /api/og-image?article=X or /api/og-image?match=X
 * Generates a branded Open Graph image for social sharing.
 *
 * Uses `@vercel/og` (built into Next.js as `next/og`) to generate a PNG
 * image at runtime. The image is 1200×630 (standard OG size).
 *
 * For articles: shows the title, author, date, and "usacricketers" branding.
 * For matches: shows team1 vs team2, format, venue, and result.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const articleId = searchParams.get("article")
  const matchId = searchParams.get("match")

  if (articleId) {
    const article = await db.article.findUnique({
      where: { id: articleId },
      select: { title: true, author: true, publishedAt: true, imageUrl: true },
    })
    if (!article) {
      return new NextResponse("Not found", { status: 404 })
    }

    const date = article.publishedAt
      ? new Date(article.publishedAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        })
      : ""

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #1e2a5e 0%, #2d3e7a 100%)",
            padding: "60px",
            fontFamily: "sans-serif",
            color: "white",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: "#ffffff", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 28, fontWeight: 900,
              color: "#1e2a5e",
            }}>
              c
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>
              usacricketers
            </div>
          </div>

          {/* Title */}
          <div style={{
            display: "flex", fontSize: 48, fontWeight: 800,
            lineHeight: 1.2, maxWidth: 900,
          }}>
            {article.title}
          </div>

          {/* Meta */}
          <div style={{ display: "flex", gap: 24, fontSize: 22, opacity: 0.8 }}>
            {article.author && <span>By {article.author}</span>}
            {date && <span>{date}</span>}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }

  if (matchId) {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { team1: true, team2: true },
    })
    if (!match) {
      return new NextResponse("Not found", { status: 404 })
    }

    const t1 = match.team1
    const t2 = match.team2

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #1e2a5e 0%, #2d3e7a 100%)",
            padding: "60px",
            fontFamily: "sans-serif",
            color: "white",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7, marginBottom: 20 }}>
            {match.format} · {match.matchNo}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 40, fontSize: 56, fontWeight: 900 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 80, height: 80, borderRadius: 16,
              background: t1?.primaryColor || "#15803d",
              fontSize: 28, color: "white",
            }}>
              {t1?.shortName?.slice(0, 3) || "?"}
            </div>
            <span>vs</span>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 80, height: 80, borderRadius: 16,
              background: t2?.primaryColor || "#0a7d1e",
              fontSize: 28, color: "white",
            }}>
              {t2?.shortName?.slice(0, 3) || "?"}
            </div>
          </div>
          {match.result ? (
            <div style={{ fontSize: 28, marginTop: 30, textAlign: "center", opacity: 0.9 }}>
              {match.result}
            </div>
          ) : (
            <div style={{ fontSize: 24, marginTop: 30, opacity: 0.7 }}>
              {match.venue || "TBD"}
            </div>
          )}
          <div style={{ position: "absolute", bottom: 40, fontSize: 22, fontWeight: 700, opacity: 0.6 }}>
            usacricketers
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }

  return new NextResponse("Missing article or match param", { status: 400 })
}
