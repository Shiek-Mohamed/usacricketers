import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const match = await db.match.findUnique({
    where: { id },
    include: { team1: true, team2: true, series: true },
  })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeMatch(match))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const match = await db.match.update({
    where: { id },
    data: {
      seriesId: body.seriesId || null,
      team1Id: body.team1Id,
      team2Id: body.team2Id,
      format: body.format,
      matchNo: body.matchNo,
      status: body.status,
      venue: body.venue,
      city: body.city,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      result: body.result,
      scorecard:
        typeof body.scorecard === "string"
          ? body.scorecard
          : body.scorecard
          ? JSON.stringify(body.scorecard)
          : "",
    },
    include: { team1: true, team2: true, series: true },
  })
  return NextResponse.json(serializeMatch(match))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await db.match.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
