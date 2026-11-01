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
  // Raw SQL UPDATE — Prisma 6.x mishandles Date objects for SQLite
  // (series.update → UPDATE ... RETURNING fails on DateTime). Build the
  // SET clause dynamically with ISO string params for date fields.
  const sets: string[] = []
  const vals: unknown[] = []
  for (const k of ["name", "shortName", "format", "season", "status", "description"]) {
    if (body[k] !== undefined) {
      sets.push(`"${k}" = ?`)
      vals.push(String(body[k]))
    }
  }
  if (body.startDate !== undefined) {
    sets.push(`"startDate" = ?`)
    vals.push(new Date(body.startDate).toISOString())
  }
  if (body.endDate !== undefined) {
    sets.push(`"endDate" = ?`)
    vals.push(new Date(body.endDate).toISOString())
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 })
  }
  sets.push(`"updatedAt" = ?`)
  vals.push(new Date().toISOString())
  vals.push(id)
  await db.$executeRawUnsafe(
    `UPDATE "Series" SET ${sets.join(", ")} WHERE "id" = ?`,
    ...vals,
  )
  const s = await db.series.findUnique({
    where: { id },
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
