import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePlayer } from "@/lib/serialize"
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
  const player = await db.player.findUnique({
    where: { id },
    include: { team: true },
  })
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializePlayer(player))
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
  const player = await db.player.update({
    where: { id },
    data: {
      name: body.name,
      teamId: body.teamId,
      role: body.role,
      isCaptain: body.isCaptain === undefined ? undefined : !!body.isCaptain,
      isKeeper: body.isKeeper === undefined ? undefined : !!body.isKeeper,
      battingStyle: body.battingStyle,
      bowlingStyle: body.bowlingStyle || "",
      battingStats:
        typeof body.battingStats === "string"
          ? body.battingStats
          : JSON.stringify(body.battingStats || {}),
      bowlingStats:
        typeof body.bowlingStats === "string"
          ? body.bowlingStats || ""
          : JSON.stringify(body.bowlingStats || {}),
      bio: body.bio,
      imageUrl: body.imageUrl,
    },
    include: { team: true },
  })
  return NextResponse.json(serializePlayer(player))
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
    await db.player.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
