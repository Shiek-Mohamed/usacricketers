import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkInternalSecret } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

// GET /api/internal/match-series?matchId=X  (header: x-internal-secret)
// Internal endpoint consumed by the score-service. Returns the seriesId for
// a match (or null when the match has no series, meaning no scorer may touch
// it). 401 if the secret is wrong, 404 if the match does not exist.
export async function GET(req: Request) {
  const secret = req.headers.get("x-internal-secret")
  if (!checkInternalSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get("matchId")
  if (!matchId) {
    return NextResponse.json(
      { error: "matchId query parameter required" },
      { status: 400 }
    )
  }

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { seriesId: true },
  })
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 })
  }

  return NextResponse.json({ seriesId: match.seriesId })
}
