import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeSeries } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

// List the admin's own leagues (with team counts).
export async function GET(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { managedSeriesIds } = auth.ctx
  if (managedSeriesIds.length === 0) return NextResponse.json([])
  const series = await db.series.findMany({
    where: { id: { in: managedSeriesIds } },
    include: { tournamentTeams: { include: { team: true } }, matches: true },
    orderBy: { startDate: "desc" },
  })
  return NextResponse.json(series.map(serializeSeries).map((s) => ({ ...s })))
}

// Create a new league. Auto-assigns the creating admin as the owner.
export async function POST(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { payload } = auth.ctx
  try {
    const body = await req.json()
    const name = String(body.name || "").trim()
    const shortName = String(body.shortName || "").trim() || name.slice(0, 10)
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })
    const format = body.format || "T20"
    const season = String(body.season || new Date().getFullYear().toString())
    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    const endDate = body.endDate ? new Date(body.endDate) : new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 60)

    const created = await db.$transaction(async (tx) => {
      const s = await tx.series.create({
        data: {
          name,
          shortName,
          format,
          season,
          startDate,
          endDate,
          status: body.status || "upcoming",
          description: String(body.description || ""),
        },
      })
      // Auto-assign the creating admin as the owner of this league.
      await tx.leagueAdminAssignment.create({
        data: { adminId: payload.adminId, seriesId: s.id },
      })
      return s
    })
    return NextResponse.json(serializeSeries(created))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
