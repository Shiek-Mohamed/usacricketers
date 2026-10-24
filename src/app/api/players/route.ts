import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePlayer } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"

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
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
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
