import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"

export const dynamic = "force-dynamic"

async function isAuthorized(req: NextRequest, seriesId: string): Promise<boolean> {
  try {
    if (requireSiteAdmin(req)) return true
    const result = await authenticateLeagueAdmin(req)
    if ("ctx" in result) {
      return result.ctx.managedSeriesIds.includes(seriesId)
    }
    return false
  } catch {
    return false
  }
}

/**
 * GET /api/series/[id]/penalties
 *
 * Public read — lists every penalty in a series with the team name +
 * shortName inlined, newest first. Same exposure as /api/standings (names +
 * numbers only).
 *
 * Returns: 200 { items: PenaltyRow[] }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const penalties = await db.penalty.findMany({
    where: { seriesId: id },
    include: { team: { select: { name: true, shortName: true } } },
    orderBy: { createdAt: "desc" },
  })
  const items = penalties.map((p) => ({
    id: p.id,
    seriesId: p.seriesId,
    teamId: p.teamId,
    teamName: p.team.name,
    teamShortName: p.team.shortName,
    type: p.type,
    value: p.value,
    reason: p.reason,
    createdAt: p.createdAt,
  }))
  const res = NextResponse.json({ items })
  res.headers.set("Cache-Control", "no-store")
  return res
}

/**
 * POST /api/series/[id]/penalties
 *
 * Authorised for site-admins (cookie + CSRF) OR league-admins (Bearer,
 * scoped to series they manage).
 *
 * Body: { teamId: string, type: "points" | "nrr", value: number, reason?: string }
 *   - type="points": value is points to DEDUCT (must be > 0).
 *   - type="nrr":    value is a signed NRR adjustment ADDED to the team's NRR.
 *
 * Returns: 201 { item: Penalty }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await isAuthorized(req, id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const { teamId, type, value, reason } = (body ?? {}) as {
    teamId?: string
    type?: string
    value?: number | string
    reason?: string
  }
  if (!teamId || typeof teamId !== "string") {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 })
  }
  if (type !== "points" && type !== "nrr") {
    return NextResponse.json(
      { error: "type must be 'points' or 'nrr'" },
      { status: 400 },
    )
  }
  const v = typeof value === "string" ? parseFloat(value) : value
  if (typeof v !== "number" || !isFinite(v)) {
    return NextResponse.json(
      { error: "value must be a finite number" },
      { status: 400 },
    )
  }
  if (type === "points" && v <= 0) {
    return NextResponse.json(
      { error: "points deduction must be positive (e.g. 2 deducts 2 points)" },
      { status: 400 },
    )
  }
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  })
  if (!team) {
    return NextResponse.json({ error: "team not found" }, { status: 400 })
  }
  const created = await db.penalty.create({
    data: {
      seriesId: id,
      teamId,
      type,
      value: v,
      reason: (reason ?? "").toString().slice(0, 500),
    },
  })
  return NextResponse.json({ item: created }, { status: 201 })
}
