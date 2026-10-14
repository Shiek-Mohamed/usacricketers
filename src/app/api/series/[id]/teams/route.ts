import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeTeam } from "@/lib/serialize"
import { cacheDelPrefix } from "@/lib/cache"

// Add an existing team to this tournament, OR create a new team + add it.
// POST /api/series/:id/teams  body: { teamId?: string } or { name, shortName, country?, primaryColor?, accentColor? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  let teamId = body.teamId as string | undefined

  // Quick-create a new team if no teamId provided
  if (!teamId && body.name) {
    const team = await db.team.create({
      data: {
        name: body.name,
        shortName: (body.shortName || body.name).toUpperCase().slice(0, 4),
        country: body.country || body.name,
        primaryColor: body.primaryColor || "#1e3a8a",
        accentColor: body.accentColor || "#f59e0b",
        description: body.description || "",
      },
    })
    teamId = team.id
  }

  if (!teamId) return NextResponse.json({ error: "teamId or name required" }, { status: 400 })

  // Link the team to the tournament (unique constraint prevents duplicates)
  try {
    await db.tournamentTeam.create({ data: { seriesId: id, teamId } })
  } catch {
    return NextResponse.json({ ok: true, message: "Already in tournament" })
  }

  cacheDelPrefix("series:list")
  const team = await db.team.findUnique({ where: { id: teamId } })
  return NextResponse.json(team ? serializeTeam(team) : { ok: true }, { status: 201 })
}
