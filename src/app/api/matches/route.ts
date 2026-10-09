import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const matches = await db.match.findMany({
    where: status ? { status } : undefined,
    include: { team1: true, team2: true, series: true },
    orderBy: { startDate: "desc" },
  })
  return NextResponse.json(matches.map(serializeMatch))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const match = await db.match.create({
    data: {
      seriesId: body.seriesId || null,
      team1Id: body.team1Id,
      team2Id: body.team2Id,
      format: body.format || "ODI",
      matchNo: body.matchNo || "1st Match",
      status: body.status || "upcoming",
      venue: body.venue || "",
      city: body.city || "",
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      result: body.result || "",
      scorecard:
        typeof body.scorecard === "string"
          ? body.scorecard
          : body.scorecard
          ? JSON.stringify(body.scorecard)
          : "",
    },
    include: { team1: true, team2: true, series: true },
  })
  return NextResponse.json(serializeMatch(match), { status: 201 })
}
