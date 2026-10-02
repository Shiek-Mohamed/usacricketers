import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeSeries } from "@/lib/serialize"

export async function GET() {
  const series = await db.series.findMany({ orderBy: { startDate: "desc" } })
  return NextResponse.json(series.map(serializeSeries))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const s = await db.series.create({
    data: {
      name: body.name,
      shortName: body.shortName,
      format: body.format || "ODI",
      season: body.season || "2025",
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : new Date(),
      status: body.status || "upcoming",
      description: body.description || "",
    },
  })
  return NextResponse.json(serializeSeries(s), { status: 201 })
}
