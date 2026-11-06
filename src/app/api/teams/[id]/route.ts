import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeTeam } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (requireSiteAdmin(req)) return true
  const leagueAdmin = await authenticateLeagueAdmin(req)
  return !!leagueAdmin
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const team = await db.team.findUnique({ where: { id } })
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeTeam(team))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  const team = await db.team.update({
    where: { id },
    data: {
      name: body.name,
      shortName: (body.shortName || "").toUpperCase(),
      country: body.country,
      primaryColor: body.primaryColor,
      accentColor: body.accentColor,
      logoUrl: body.logoUrl ?? undefined,
      description: body.description,
    },
  })
  return NextResponse.json(serializeTeam(team))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    await db.team.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
