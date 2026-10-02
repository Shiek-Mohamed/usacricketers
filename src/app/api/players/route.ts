import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePlayer } from "@/lib/serialize"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const teamId = searchParams.get("teamId")
  const players = await db.player.findMany({
    where: teamId ? { teamId } : undefined,
    include: { team: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })
  return NextResponse.json(players.map(serializePlayer))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const player = await db.player.create({
    data: {
      name: body.name,
      teamId: body.teamId,
      role: body.role || "Batsman",
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
