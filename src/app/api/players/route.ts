import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePlayer } from "@/lib/serialize"
import { requireSiteAdmin, verifyScorerToken, readBearerToken } from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (requireSiteAdmin(req)) return true
  const leagueAdmin = await authenticateLeagueAdmin(req)
  if (leagueAdmin) return true
  // Scorers can also create players (e.g. adding a late arrival to the
  // team list during live scoring). The scorer token is verified + the
  // god-mode token (tournamentIds: ["*"]) covers all teams.
  const token = readBearerToken(req.headers.get("authorization"))
  const payload = verifyScorerToken(token)
  return !!payload
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const teamId = searchParams.get("teamId")
  const players = await db.player.findMany({
    where: teamId ? { teamId } : undefined,
    include: { team: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })
  const res = NextResponse.json(players.map(serializePlayer))
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  )
  return res
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  const player = await db.player.create({
    data: {
      name: body.name,
      teamId: body.teamId,
      role: body.role || "Batsman",
      isCaptain: !!body.isCaptain,
      isKeeper: !!body.isKeeper,
      battingStyle: body.battingStyle || "Right-hand bat",
      bowlingStyle: body.bowlingStyle || "",
      battingStats: body.battingStats || "{}",
      bowlingStats: body.bowlingStats || "",
      bio: body.bio || "",
      imageUrl: body.imageUrl || "",
    },
    include: { team: true },
  })
  return NextResponse.json(serializePlayer(player), { status: 201 })
}
