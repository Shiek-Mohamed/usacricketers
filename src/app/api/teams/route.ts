import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeTeam } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

/** Check if the request is from a site admin OR a league admin.
 *  Returns true if either auth passes. */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Site admin (cookie-based auth)
  if (requireSiteAdmin(req)) return true
  // League admin (Bearer token auth)
  const leagueAdmin = await authenticateLeagueAdmin(req)
  return !!leagueAdmin
}

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
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
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
