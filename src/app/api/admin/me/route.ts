import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { serializeSiteAdmin } from "@/lib/serialize"

export const dynamic = "force-dynamic"

/** GET /api/admin/me — returns the logged-in site admin, or 401. */
export async function GET(req: NextRequest) {
  const payload = requireSiteAdmin(req)
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  // Re-read from DB so deactivation takes effect immediately.
  const admin = await db.siteAdmin.findUnique({ where: { id: payload.adminId } })
  if (!admin || !admin.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return NextResponse.json(serializeSiteAdmin(admin))
}
