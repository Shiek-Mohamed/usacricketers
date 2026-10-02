import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePlayer } from "@/lib/serialize"

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
  const body = await req.json()
  const player = await db.player.update({
    where: { id },
    data: {
      name: body.name,
      teamId: body.teamId,
      role: body.role,
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await db.player.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
