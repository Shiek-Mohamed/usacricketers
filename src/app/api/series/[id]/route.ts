import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeSeries, serializeTeam } from "@/lib/serialize"
import { cacheDelPrefix } from "@/lib/cache"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const s = await db.series.findUnique({
    where: { id },
    include: { tournamentTeams: { include: { team: true } } },
  })
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeSeries(s))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  // Build the update data object dynamically
  const data: Record<string, unknown> = {}
  for (const k of ["name", "shortName", "format", "season", "status", "description"]) {
    if (body[k] !== undefined) data[k] = String(body[k])
  }
  if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
  if (body.endDate !== undefined) data.endDate = new Date(body.endDate)
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 })
  }
  const s = await db.series.update({
    where: { id },
    data,
    include: { tournamentTeams: { include: { team: true } } },
  })
  cacheDelPrefix("series:list")
  return NextResponse.json(serializeSeries(s))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    await db.series.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  cacheDelPrefix("series:list")
  return NextResponse.json({ ok: true })
}
