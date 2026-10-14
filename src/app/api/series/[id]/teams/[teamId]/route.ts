import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheDelPrefix } from "@/lib/cache"

// Remove a team from a tournament.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  const { id, teamId } = await params
  try {
    await db.tournamentTeam.delete({
      where: { seriesId_teamId: { seriesId: id, teamId } },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  cacheDelPrefix("series:list")
  return NextResponse.json({ ok: true })
}
