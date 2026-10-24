import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePlayer } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"

/**
 * POST /api/players/bulk
 *
 * Bulk-create players for a team. Site-admin only.
 *
 * Body:
 *   {
 *     teamId: string,
 *     players: Array<{
 *       name: string,                 // required
 *       role?: string,                // default "Batsman"
 *       battingStyle?: string,        // default "Right-hand bat"
 *       bowlingStyle?: string,        // default ""
 *       bio?: string,
 *       imageUrl?: string,
 *     }>
 *   }
 *
 * Returns:
 *   200 { created: number, skipped: number, skippedNames: string[], players: Player[] }
 *   400 { error: "Team is required" | "No players provided" | "Team not found: <id>" }
 *   401 { error: "unauthorized" }
 *
 * Each row is created inside a single Prisma transaction. Rows whose `name`
 * already exists on this team (case-insensitive, trimmed) are skipped — the
 * client gets a `skippedNames` list back so it can show the user exactly
 * which ones weren't re-imported.
 */
export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { teamId, players } = body as {
    teamId?: string
    players?: Array<Record<string, unknown>>
  }

  if (!teamId || typeof teamId !== "string") {
    return NextResponse.json({ error: "Team is required" }, { status: 400 })
  }
  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json(
      { error: "No players provided" },
      { status: 400 }
    )
  }

  // Confirm the team exists — also so the FK in the transaction can resolve.
  const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true } })
  if (!team) {
    return NextResponse.json(
      { error: `Team not found: ${teamId}` },
      { status: 400 }
    )
  }

  // Fetch existing names on this team (case-insensitive dedupe).
  const existing = await db.player.findMany({
    where: { teamId },
    select: { name: true },
  })
  const existingNames = new Set(
    existing.map((p) => p.name.trim().toLowerCase())
  )

  // Normalise + dedupe the incoming rows. Keep the first occurrence of any
  // duplicate name within the request itself, so the admin doesn't get two
  // rows of "John Smith" silently merged.
  const seenInBatch = new Set<string>()
  const toCreate: Array<{
    name: string
    teamId: string
    role: string
    battingStyle: string
    bowlingStyle: string
    bio: string
    imageUrl: string
  }> = []
  const skippedNames: string[] = []

  for (const row of players) {
    if (!row || typeof row !== "object") continue
    const rawName = String(row.name ?? "").trim()
    if (!rawName) continue
    const key = rawName.toLowerCase()
    if (existingNames.has(key) || seenInBatch.has(key)) {
      skippedNames.push(rawName)
      continue
    }
    seenInBatch.add(key)
    toCreate.push({
      name: rawName,
      teamId,
      role: String(row.role || "Batsman").trim() || "Batsman",
      isCaptain: !!row.isCaptain,
      isKeeper: !!row.isKeeper,
      battingStyle:
        String(row.battingStyle || "Right-hand bat").trim() ||
        "Right-hand bat",
      bowlingStyle: String(row.bowlingStyle || "").trim(),
      bio: String(row.bio || "").trim(),
      imageUrl: String(row.imageUrl || "").trim(),
    })
  }

  if (toCreate.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: skippedNames.length,
      skippedNames,
      players: [] as never[],
    })
  }

  // Single transaction: all-or-nothing create. SQLite/MySQL both support
  // createMany; the Prisma client we're using here is fine for ~hundreds of
  // rows in one go.
  const created = await db.$transaction(
    toCreate.map((p) =>
      db.player.create({
        data: {
          name: p.name,
          teamId: p.teamId,
          role: p.role,
          isCaptain: p.isCaptain,
          isKeeper: p.isKeeper,
          battingStyle: p.battingStyle,
          bowlingStyle: p.bowlingStyle,
          bio: p.bio,
          imageUrl: p.imageUrl,
        },
        include: { team: true },
      })
    )
  )

  return NextResponse.json({
    created: created.length,
    skipped: skippedNames.length,
    skippedNames,
    players: created.map(serializePlayer),
  })
}
