import { NextRequest, NextResponse } from "next/server"
import { db } from "./db"
import {
  verifyLeagueAdminToken,
  readBearerToken,
  type LeagueAdminTokenPayload,
} from "./scorer-auth"

export interface LeagueAdminContext {
  payload: LeagueAdminTokenPayload
  managedSeriesIds: string[]
}

/**
 * Authenticate a league admin from a request's Bearer token, re-read their
 * assignments from the DB (so changes take effect immediately), and return
 * the context. Returns null + writes a 401 response if the token is invalid
 * or the admin is inactive.
 */
export async function authenticateLeagueAdmin(
  req: NextRequest
): Promise<{ ctx: LeagueAdminContext } | { response: NextResponse }> {
  const token = readBearerToken(req.headers.get("authorization"))
  const payload = verifyLeagueAdminToken(token)
  if (!payload) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    }
  }
  const admin = await db.leagueAdmin.findUnique({
    where: { id: payload.adminId },
    include: { assignments: true },
  })
  if (!admin || !admin.active) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    }
  }
  const managedSeriesIds = admin.assignments.map((a) => a.seriesId)
  return { ctx: { payload, managedSeriesIds } }
}
