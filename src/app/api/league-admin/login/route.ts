import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  verifyPassword,
  issueLeagueAdminToken,
} from "@/lib/scorer-auth"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** POST /api/league-admin/login — rate-limited (10 attempts / 10 min / IP). */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, windowMs: 10 * 60 * 1000 })
  if (limited) return limited

  try {
    const body = await req.json()
    const username = String(body.username || "").trim()
    const password = String(body.password || "")
    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password are required" },
        { status: 400 }
      )
    }
    const admin = await db.leagueAdmin.findUnique({
      where: { username },
      include: { assignments: true },
    })
    if (
      !admin ||
      !admin.active ||
      !verifyPassword(password, admin.passwordHash)
    ) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    const managedSeriesIds = admin.assignments.map((a) => a.seriesId)
    const token = issueLeagueAdminToken({
      adminId: admin.id,
      name: admin.name,
      username: admin.username,
      managedSeriesIds,
    })
    return NextResponse.json({
      admin: { id: admin.id, name: admin.name, username: admin.username },
      token,
      managedSeriesIds,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
