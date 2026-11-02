import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSiteAdmin, verifyPassword, hashPassword } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/change-password
 * Body: { currentPassword, newPassword }
 * Requires: site admin auth (sa-session cookie + CSRF header)
 */
export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const currentPassword = String(body.currentPassword || "")
    const newPassword = String(body.newPassword || "")

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 },
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 },
      )
    }

    // Verify current password
    const fullAdmin = await db.siteAdmin.findUnique({
      where: { id: admin.adminId },
    })
    if (!fullAdmin || !verifyPassword(currentPassword, fullAdmin.passwordHash)) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      )
    }

    // Update password
    await db.siteAdmin.update({
      where: { id: admin.adminId },
      data: { passwordHash: hashPassword(newPassword) },
    })

    return NextResponse.json({ ok: true, message: "Password changed successfully" })
  } catch (e) {
    return NextResponse.json(
      { error: String(e).slice(0, 200) },
      { status: 500 },
    )
  }
}
