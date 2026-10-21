import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  verifyPassword,
  issueLeagueAdminToken,
} from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
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
