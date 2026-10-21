import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeScorer } from "@/lib/serialize"
import { authenticateLeagueAdmin } from "@/lib/league-admin-guard"
import { hashPassword, isValidEmail } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

// A scorer is editable by a league admin only if the scorer has at least one
// assignment in one of the admin's managed leagues.
async function ownedScorer(req: NextRequest, id: string) {
  const auth = await authenticateLeagueAdmin(req)
  if ("response" in auth) return { auth: null, scorer: null, forbidden: true }
  const s = await db.scorer.findUnique({
    where: { id },
    include: { assignments: true },
  })
  if (!s) return { auth, scorer: null, forbidden: false }
  const hasOwned = s.assignments.some((a) =>
    auth.ctx.managedSeriesIds.includes(a.seriesId)
  )
  return { auth, scorer: s, forbidden: !hasOwned }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { auth, scorer, forbidden } = await ownedScorer(req, id)
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (forbidden) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  if (!scorer) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(serializeScorer(scorer))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { auth, scorer, forbidden } = await ownedScorer(req, id)
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (forbidden) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  if (!scorer) return NextResponse.json({ error: "not found" }, { status: 404 })
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name)
    if (body.email !== undefined) {
      if (!isValidEmail(String(body.email))) {
        return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
      }
      data.email = String(body.email).trim()
    }
    if (body.active !== undefined) data.active = !!body.active
    if (body.password) data.passwordHash = hashPassword(String(body.password))

    // Full re-assignment: ALL seriesIds must be within the admin's managed
    // leagues (they can't assign a scorer to a league they don't manage).
    if (Array.isArray(body.tournamentIds)) {
      const requested = body.tournamentIds as string[]
      const allowed = requested.filter((sid) =>
        auth.ctx.managedSeriesIds.includes(sid)
      )
      await db.$transaction(async (tx) => {
        await tx.scorerAssignment.deleteMany({ where: { scorerId: id } })
        if (allowed.length > 0) {
          await tx.scorerAssignment.createMany({
            data: allowed.map((sid) => ({ scorerId: id, seriesId: sid })),
          })
        }
      })
    }
    const updated = await db.scorer.update({
      where: { id },
      data,
      include: { assignments: true },
    })
    return NextResponse.json(serializeScorer(updated))
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { auth, scorer, forbidden } = await ownedScorer(req, id)
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (forbidden) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  if (!scorer) return NextResponse.json({ error: "not found" }, { status: 404 })
  try {
    await db.scorer.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
