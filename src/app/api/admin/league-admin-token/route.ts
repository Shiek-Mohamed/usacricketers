import { NextResponse, type NextRequest } from "next/server"
import { requireSiteAdmin, issueLeagueAdminToken } from "@/lib/scorer-auth"

/**
 * POST /api/admin/league-admin-token
 *
 * Lets an authenticated **site admin** mint a short-lived league-admin
 * equivalent token (signed with the same SCORER_SECRET the league-admin
 * endpoints use) carrying `managedSeriesIds: ["*"]` — god-mode — so they
 * can act as a super-league-admin across all leagues without having to
 * create a separate LeagueAdmin account.
 *
 * Mirrors POST /api/admin/scorer-token (which mints a god-mode scorer
 * token with `tournamentIds: ["*"]`). Same TTL (12h), same pattern.
 *
 * Why this exists: site admins sometimes need to drive the league-admin
 * flows (managing matches, assigning scorers within a league) without
 * logging out + logging back in as a specific league admin. This endpoint
 * lets the frontend fall back to a god-mode league-admin token when the
 * user is a site admin.
 *
 * Returns:
 *   { token: string, exp: number }   (200) on success
 *   { error: "unauthorized" }         (401) when the sa-session cookie is missing/invalid
 *
 * Usage (frontend):
 *   const res = await fetch("/api/admin/league-admin-token", { method: "POST", credentials: "include" })
 *   const { token } = await res.json()
 *   // token is god-mode — use in Authorization: Bearer <token> header for league-admin endpoints
 */
export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // God-mode token: managedSeriesIds = ["*"] is recognised by the league-admin
  // API endpoints (verifyLeagueAdminToken) as "manage all leagues". The TTL
  // matches issueLeagueAdminToken's internal 12h — long enough for a full
  // day's work, short enough that a leaked token is bounded.
  const token = issueLeagueAdminToken({
    adminId: `site-admin:${admin.adminId}`,
    name: admin.name,
    username: admin.email,
    managedSeriesIds: ["*"],
  })

  // Echo the TTL so the client can refresh proactively.
  const exp = Date.now() + 1000 * 60 * 60 * 12
  return NextResponse.json({ token, exp })
}
