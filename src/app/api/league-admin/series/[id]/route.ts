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
    // Build a raw SQL UPDATE — Prisma 6.x mishandles Date objects for
    // SQLite (series.update → UPDATE ... RETURNING fails with "Inconsistent
    // column data" on startDate/endDate). Raw SQL with ISO string params
    // bypasses this; reads via findUnique work fine.
    const sets: string[] = []
    const params: unknown[] = []
    for (const k of ["name", "shortName", "format", "season", "status", "description"]) {
      if (body[k] !== undefined) {
        sets.push(`"${k}" = ?`)
        params.push(String(body[k]))
      }
    }
    if (body.startDate !== undefined) {
      sets.push(`"startDate" = ?`)
      params.push(new Date(body.startDate).toISOString())
    }
    if (body.endDate !== undefined) {
      sets.push(`"endDate" = ?`)
      params.push(new Date(body.endDate).toISOString())
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 })
    }
    sets.push(`"updatedAt" = ?`)
    params.push(new Date().toISOString())
    params.push(id)
    await db.$executeRawUnsafe(
      `UPDATE "Series" SET ${sets.join(", ")} WHERE "id" = ?`,
      ...params,
    )
    const updated = await db.series.findUnique({ where: { id } })
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 })
    }
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
