import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  verifyLeagueAdminToken,
  readBearerToken,
} from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = readBearerToken(req.headers.get("authorization"))
  const payload = verifyLeagueAdminToken(token)
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  // Re-read assignments from DB so admin changes (added/removed leagues,
  // deactivated) take effect immediately.
  const admin = await db.leagueAdmin.findUnique({
    where: { id: payload.adminId },
    include: { assignments: true },
  })
  if (!admin || !admin.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const managedSeriesIds = admin.assignments.map((a) => a.seriesId)
  return NextResponse.json({
    admin: { id: admin.id, name: admin.name, username: admin.username },
    managedSeriesIds,
  })
}
