import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  verifyPassword,
  issueSiteAdminToken,
  SITE_ADMIN_COOKIE,
  isValidEmail,
} from "@/lib/scorer-auth"
import { serializeSiteAdmin } from "@/lib/serialize"

export const dynamic = "force-dynamic"

const COOKIE_MAX_AGE = 60 * 60 * 12 // 12 hours

/** POST /api/admin/login — email + password → sets an httpOnly signed cookie. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || "").trim()
    const password = String(body.password || "")
    if (!isValidEmail(email) || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }
    const admin = await db.siteAdmin.findUnique({ where: { email } })
    if (!admin || !admin.active || !verifyPassword(password, admin.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }
    const token = issueSiteAdminToken({
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    })
    const res = NextResponse.json(serializeSiteAdmin(admin), { status: 200 })
    res.cookies.set(SITE_ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
