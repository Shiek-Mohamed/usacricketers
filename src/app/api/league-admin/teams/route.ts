import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeTeam } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

// List all teams (so a league admin can add existing ones to their league).
export async function GET(req: NextRequest) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return auth.response
  const teams = await db.team.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(teams.map(serializeTeam))
}
