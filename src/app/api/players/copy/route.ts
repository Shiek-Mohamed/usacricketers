import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

/**
 * POST /api/players/copy
 *
 * Copy an entire team's player roster into another team — the "Copy from
 * Team" option in the bulk-players dialog. Useful when a club's squad
 * carries over between seasons/series and the admin doesn't want to re-type
 * or re-upload the whole roster for the new team entry.
 *
 * Authorised for site-admins (cookie auth) OR league-admins (Bearer token).
 *
 * Body: { sourceTeamId: string, targetTeamId: string }
 *
 * Players whose name (case-insensitive, trimmed) already exists on the
 * target team are skipped — returned in `skippedNames`. Captain flags are
 * NOT copied (captaincy is team-specific); wicket-keeper is carried over.
 *
 * Returns: 200 { created, skipped, skippedNames }
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  try {
    // Site admin (cookie + CSRF)
    if (requireSiteAdmin(req)) return true
    // League admin (Bearer) — authenticateLeagueAdmin returns {ctx} on
    // success or {response: 401} on failure; a missing/invalid Bearer token
    // makes verifyLeagueAdminToken throw, caught here → false (→ 401).
    const result = await authenticateLeagueAdmin(req)
    return "ctx" in result
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const { sourceTeamId, targetTeamId } = (body ?? {}) as {
    sourceTeamId?: string
    targetTeamId?: string
  }

  if (!sourceTeamId || !targetTeamId) {
    return NextResponse.json(
      { error: "sourceTeamId and targetTeamId are required" },
      { status: 400 },
    )
  }
  if (sourceTeamId === targetTeamId) {
    return NextResponse.json(
      { error: "Source and target team must be different" },
      { status: 400 },
    )
  }

  const [sourceTeam, targetTeam] = await Promise.all([
    db.team.findUnique({ where: { id: sourceTeamId }, select: { id: true, name: true } }),
    db.team.findUnique({ where: { id: targetTeamId }, select: { id: true, name: true } }),
  ])
  if (!sourceTeam) {
    return NextResponse.json({ error: "Source team not found" }, { status: 400 })
  }
  if (!targetTeam) {
    return NextResponse.json({ error: "Target team not found" }, { status: 400 })
  }

  const sourcePlayers = await db.player.findMany({
    where: { teamId: sourceTeamId },
  })
  if (sourcePlayers.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: 0,
      skippedNames: [],
      message: `${sourceTeam.name} has no players to copy`,
    })
  }

  const existing = await db.player.findMany({
    where: { teamId: targetTeamId },
    select: { name: true },
  })
  const existingNames = new Set(
    existing.map((p) => p.name.trim().toLowerCase()),
  )

  const toCreate = sourcePlayers.filter(
    (p) => !existingNames.has(p.name.trim().toLowerCase()),
  )
  const skippedNames = sourcePlayers
    .filter((p) => existingNames.has(p.name.trim().toLowerCase()))
    .map((p) => p.name)

  if (toCreate.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: skippedNames.length,
      skippedNames,
      message: `All ${skippedNames.length} player${skippedNames.length === 1 ? "" : "s"} already exist on ${targetTeam.name}`,
    })
  }

  const created = await db.$transaction(
    toCreate.map((p) =>
      db.player.create({
        data: {
          name: p.name,
          teamId: targetTeamId,
          role: p.role,
          isCaptain: false,
          isKeeper: p.isKeeper,
          battingStyle: p.battingStyle,
          bowlingStyle: p.bowlingStyle,
          bio: p.bio,
          imageUrl: p.imageUrl,
        },
      }),
    ),
  )

  return NextResponse.json({
    created: created.length,
    skipped: skippedNames.length,
    skippedNames,
  })
}
