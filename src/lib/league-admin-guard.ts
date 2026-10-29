import { NextRequest, NextResponse } from "next/server"
import { db } from "./db"
import {
  verifyLeagueAdminToken,
  readBearerToken,
  isGodModeLeagueAdmin,
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
 *
 * God-mode handling: tokens minted via POST /api/admin/league-admin-token
 * (for site admins) carry `managedSeriesIds: ["*"]` + an adminId starting
 * with `site-admin:`. There's no real LeagueAdmin row for them, so the DB
 * lookup is skipped — instead, we fetch ALL series IDs from the DB so the
 * existing endpoint checks (managedSeriesIds.includes(seriesId), in: [...])
 * work without modification. This means god-mode tokens effectively
 * "manage all leagues" without each endpoint needing god-mode-aware code.
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

  // God-mode: site-admin-minted token. Skip the LeagueAdmin DB lookup (no
  // real row exists for adminId="site-admin:<id>") + return ALL series IDs.
  if (isGodModeLeagueAdmin(payload.managedSeriesIds)) {
    const allSeries = await db.series.findMany({
      select: { id: true },
    })
    return {
      ctx: {
        payload,
        managedSeriesIds: allSeries.map((s) => s.id),
      },
    }
  }

  // Regular flow: re-read assignments from DB.
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
