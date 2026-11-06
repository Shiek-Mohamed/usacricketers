import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/** POST /api/scoring-audit — logs a scoring action to the audit trail.
 *  Body: { matchId, scorerId?, action, ballNo?, detail? }
 *  Non-fatal — errors are logged but don't block scoring. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await db.scoringAudit.create({
      data: {
        matchId: String(body.matchId || ""),
        scorerId: body.scorerId || null,
        action: String(body.action || "unknown"),
        ballNo: Number(body.ballNo) || 0,
        detail: String(body.detail || ""),
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Non-fatal — scoring must continue even if audit logging fails
    console.error("[scoring-audit] Failed to log:", e)
    return NextResponse.json({ ok: false, error: String(e).slice(0, 100) }, { status: 500 })
  }
}

/** GET /api/scoring-audit?matchId=X — retrieves the audit trail for a match. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get("matchId")
  if (!matchId) return NextResponse.json([])
  try {
    const logs = await db.scoringAudit.findMany({
      where: { matchId },
      orderBy: { timestamp: "asc" },
      take: 500,
    })
    return NextResponse.json(logs)
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
