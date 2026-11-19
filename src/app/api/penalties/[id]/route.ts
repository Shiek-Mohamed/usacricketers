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
 * DELETE /api/penalties/[id]
 *
 * Authorised for site-admins (cookie + CSRF) OR the league-admin that
 * manages the penalty's series. Fetches the penalty first to scope-check
 * the series before deleting.
 *
 * Returns: 200 { ok: true } | 404 | 401
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const penalty = await db.penalty.findUnique({
    where: { id },
    select: { id: true, seriesId: true },
  })
  if (!penalty) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  if (!(await isAuthorized(req, penalty.seriesId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  await db.penalty.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
