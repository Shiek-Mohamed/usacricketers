import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeTeam } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

// List teams in a managed league.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const { id } = await params
  if (!auth.ctx.managedSeriesIds.includes(id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const tts = await db.tournamentTeam.findMany({
    where: { seriesId: id },
    include: { team: true },
  })
  return NextResponse.json(tts.map((tt) => serializeTeam(tt.team)))
}

// Add an existing team (or create a new one inline) to a managed league.
export async function POST(
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
    let teamId = String(body.teamId || "")
    // Inline-create a new team if the admin passed name/shortName instead.
    if (!teamId && body.name) {
      const t = await db.team.create({
        data: {
          name: String(body.name),
          shortName: String(body.shortName || body.name.slice(0, 4).toUpperCase()),
          country: String(body.country || ""),
          primaryColor: String(body.primaryColor || "#1e3a8a"),
          accentColor: String(body.accentColor || "#f59e0b"),
          description: String(body.description || ""),
        },
      })
      teamId = t.id
    }
    if (!teamId) return NextResponse.json({ error: "teamId or name required" }, { status: 400 })
    const team = await db.team.findUnique({ where: { id: teamId } })
    if (!team) return NextResponse.json({ error: "team not found" }, { status: 404 })
    await db.tournamentTeam.upsert({
      where: { seriesId_teamId: { seriesId: id, teamId } },
      create: { seriesId: id, teamId },
      update: {},
    })
    return NextResponse.json(serializeTeam(team))
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
  const url = new URL(req.url)
  const teamId = url.searchParams.get("teamId")
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })
  try {
    await db.tournamentTeam.deleteMany({ where: { seriesId: id, teamId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
