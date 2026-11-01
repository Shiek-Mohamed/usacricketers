import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeTeam } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export async function GET() {
  const teams = await db.team.findMany({ orderBy: { name: "asc" } })
  const res = NextResponse.json(teams.map(serializeTeam))
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
  const team = await db.team.create({
    data: {
      name: body.name,
      shortName: (body.shortName || "").toUpperCase(),
      country: body.country || body.name,
      primaryColor: body.primaryColor || "#1e3a8a",
      accentColor: body.accentColor || "#f59e0b",
      logoUrl: body.logoUrl || null,
      description: body.description || "",
    },
  })
  return NextResponse.json(serializeTeam(team), { status: 201 })
}
