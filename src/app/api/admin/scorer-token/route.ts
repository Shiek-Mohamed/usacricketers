import { NextResponse, type NextRequest } from "next/server"
import { requireSiteAdmin, issueScorerToken } from "@/lib/scorer-auth"

/**
 * POST /api/admin/scorer-token
 *
 * Lets an authenticated **site admin** mint a short-lived scorer-equivalent
 * token (signed with the same SCORER_SECRET the score-service uses) carrying
 * `tournamentIds: ["*"]` — god-mode — so they can drive the live scorer for
 * any match without having to set up a separate scorer account.
 *
 * Why this exists: the LiveScorerView needs a scorer token to authenticate
 * `operator:state` / `operator:clear` socket emits. Site admins log in with
 * a different cookie (sa-session) that the score-service doesn't understand,
 * so before this route they had to create a Scorer account first, assign it
 * to the tournament, log out, then log back in as that scorer. Now they can
 * score any match directly from admin mode.
 *
 * Returns:
 *   { token: string, exp: number }   (200) on success
 *   { error: "unauthorized" }         (401) when the sa-session cookie is missing/invalid
 */
export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // God-mode token: tournamentIds = ["*"] is recognised by the score-service
  // as "skip the series lookup + tournament membership check". The TTL is
  // whatever scorer-auth.issueScorerToken uses internally (12h) — long enough
  // to score a Test, short enough that a leaked token is bounded.
  const token = issueScorerToken({
    scorerId: `site-admin:${admin.adminId}`,
    name: admin.name,
    username: admin.email,
    tournamentIds: ["*"],
  })

  // Echo the TTL so the client can refresh proactively (the score-service
  // rejects expired tokens with a 401-style socket error).
  const exp = Date.now() + 1000 * 60 * 60 * 12
  return NextResponse.json({ token, exp })
}
