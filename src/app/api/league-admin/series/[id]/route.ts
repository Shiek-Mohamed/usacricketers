import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeSeries } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { id } = await params
  if (!auth.ctx.managedSeriesIds.includes(id)) {
    return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
  }
  const s = await db.series.findUnique({
    where: { id },
    include: {
      tournamentTeams: { include: { team: true } },
      matches: { include: { team1: true, team2: true }, orderBy: { startDate: "asc" } },
    },
  })
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(serializeSeries(s))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { id } = await params
  if (!auth.ctx.managedSeriesIds.includes(id)) {
    return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
  }
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    for (const k of ["name", "shortName", "format", "season", "status", "description"]) {
      if (body[k] !== undefined) data[k] = String(body[k])
    }
    if (body.startDate) data.startDate = new Date(body.startDate)
    if (body.endDate) data.endDate = new Date(body.endDate)
    const updated = await db.series.update({ where: { id }, data })
    return NextResponse.json(serializeSeries(updated))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { id } = await params
  if (!auth.ctx.managedSeriesIds.includes(id)) {
    return NextResponse.json({ error: "forbidden: not your league" }, { status: 403 })
  }
  try {
    await db.series.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
