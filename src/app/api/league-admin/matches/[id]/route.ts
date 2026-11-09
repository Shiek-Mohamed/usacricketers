import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

async function getOwnedMatch(req: NextRequest, id: string) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return { auth: null, match: null, forbidden: true }
  const m = await db.match.findUnique({
    where: { id },
    select: { id: true, seriesId: true },
  })
  if (!m) return { auth, match: null, forbidden: false }
  if (!m.seriesId || !auth.ctx.managedSeriesIds.includes(m.seriesId)) {
    return { auth, match: null, forbidden: true }
  }
  return { auth, match: m, forbidden: false }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const m = await db.match.findUnique({
    where: { id },
    include: { team1: true, team2: true, series: true },
  })
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 })
  if (!m.seriesId || !auth.ctx.managedSeriesIds.includes(m.seriesId)) {
    return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
  }
  return NextResponse.json(serializeMatch(m))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const existing = await db.match.findUnique({ where: { id }, select: { seriesId: true } })
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 })
  if (!existing.seriesId || !auth.ctx.managedSeriesIds.includes(existing.seriesId)) {
    return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
  }
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    for (const k of ["format", "matchNo", "status", "venue", "city", "result", "scorecard", "umpires", "tvUmpire", "referee"]) {
      if (body[k] !== undefined) data[k] = String(body[k])
    }
    if (body.startDate) data.startDate = new Date(body.startDate)
    if (body.team1Id) data.team1Id = String(body.team1Id)
    if (body.team2Id) data.team2Id = String(body.team2Id)
    const updated = await db.match.update({
      where: { id },
      data,
      include: { team1: true, team2: true, series: true },
    })
    return NextResponse.json(serializeMatch(updated))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const existing = await db.match.findUnique({ where: { id }, select: { seriesId: true } })
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 })
  if (!existing.seriesId || !auth.ctx.managedSeriesIds.includes(existing.seriesId)) {
    return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
  }
  try {
    await db.match.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
