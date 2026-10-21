import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeScorer } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"
import { hashPassword } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

// List scorers that have an assignment in any of the admin's managed leagues.
export async function GET(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { managedSeriesIds } = auth.ctx
  if (managedSeriesIds.length === 0) return NextResponse.json([])
  const assignments = await db.scorerAssignment.findMany({
    where: { seriesId: { in: managedSeriesIds } },
    select: { scorerId: true },
    distinct: ["scorerId"],
  })
  const ids = assignments.map((a) => a.scorerId)
  if (ids.length === 0) return NextResponse.json([])
  const scorers = await db.scorer.findMany({
    where: { id: { in: ids } },
    include: { assignments: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(scorers.map(serializeScorer))
}

// Create a scorer account and assign them to one of the admin's managed leagues.
export async function POST(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { managedSeriesIds } = auth.ctx
  try {
    const body = await req.json()
    const username = String(body.username || "").trim()
    const password = String(body.password || "")
    const name = String(body.name || "").trim()
    const seriesId = String(body.seriesId || "")
    if (!username || !password || !name) {
      return NextResponse.json({ error: "username, password, name are required" }, { status: 400 })
    }
    if (!seriesId || !managedSeriesIds.includes(seriesId)) {
      return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
    }
    const dup = await db.scorer.findUnique({ where: { username } })
    if (dup) return NextResponse.json({ error: "username already exists" }, { status: 409 })
    const created = await db.$transaction(async (tx) => {
      const s = await tx.scorer.create({
        data: {
          username,
          passwordHash: hashPassword(password),
          name,
          active: body.active !== false,
        },
      })
      await tx.scorerAssignment.create({
        data: { scorerId: s.id, seriesId },
      })
      return tx.scorer.findUnique({ where: { id: s.id }, include: { assignments: true } })
    })
    return NextResponse.json(serializeScorer(created!))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
