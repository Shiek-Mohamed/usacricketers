import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyScorerToken } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

// GET /api/scorer/me  (Authorization: Bearer <token>)
// Re-reads assignments from the DB on every call — admin may have changed them
// since the token was issued. We do NOT re-issue the token here; the client
// keeps the token it has. Socket auth (score-service) still checks the token's
// embedded tournamentIds list — see worklog tradeoff note.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const token = auth.slice("Bearer ".length).trim()
  const payload = verifyScorerToken(token)
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scorer = await db.scorer.findUnique({
    where: { id: payload.scorerId },
    include: { assignments: true },
  })
  if (!scorer || !scorer.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tournamentIds = scorer.assignments.map((a) => a.seriesId)

  return NextResponse.json({
    scorer: {
      id: scorer.id,
      name: scorer.name,
      username: scorer.username,
    },
    tournamentIds,
  })
}
