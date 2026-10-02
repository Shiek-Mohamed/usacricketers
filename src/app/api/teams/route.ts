import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeTeam } from "@/lib/serialize"

export async function GET() {
  const teams = await db.team.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(teams.map(serializeTeam))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const team = await db.team.create({
    data: {
      name: body.name,
      shortName: (body.shortName || "").toUpperCase(),
      country: body.country || body.name,
      primaryColor: body.primaryColor || "#1e3a8a",
      accentColor: body.accentColor || "#f59e0b",
      description: body.description || "",
    },
  })
  return NextResponse.json(serializeTeam(team), { status: 201 })
}
