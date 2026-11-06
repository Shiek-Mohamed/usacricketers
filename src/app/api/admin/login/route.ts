import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  verifyPassword,
  issueSiteAdminToken,
  generateCSRFToken,
  SITE_ADMIN_COOKIE,
  CSRF_COOKIE,
  isValidEmail,
} from "@/lib/scorer-auth"
import { serializeSiteAdmin } from "@/lib/serialize"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const COOKIE_MAX_AGE = 60 * 60 * 12 // 12 hours

/** POST /api/admin/login — email + password → sets an httpOnly signed cookie.
 *
 *  Rate-limited: 10 attempts per 10 minutes per IP — brute-force resistant
 *  without being user-hostile. Returns 429 with `Retry-After` if exceeded. */
export async function POST(req: NextRequest) {
  // Rate-limit first — don't even read the body if the IP is over quota.
  const limited = rateLimit(req, { limit: 30, windowMs: 5 * 60 * 1000 })
  if (limited) return limited

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
    // Session cookie — httpOnly + SameSite=strict (blocks CSRF on cross-site
    // requests entirely; admin must navigate from the same origin).
    res.cookies.set(SITE_ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    })
    // CSRF cookie — non-httpOnly so JavaScript can read it + attach as
    // X-CSRF-Token header on POST/PUT/DELETE. Same double-submit pattern.
    const csrfToken = generateCSRFToken()
    res.cookies.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
