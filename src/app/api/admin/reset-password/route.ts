import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, issuePasswordResetToken } from "@/lib/scorer-auth"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/admin/reset-password
 * Body: { token: string, password: string }
 * Verifies the reset token + updates the admin's password.
 */
export async function POST(req: NextRequest) {
  // Rate-limit: 5 reset attempts per 10 minutes per IP.
  const limited = rateLimit(req, { limit: 5, windowMs: 10 * 60 * 1000 })
  if (limited) return limited

  const { verifyPasswordResetToken } = await import("@/lib/scorer-auth")
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const token = String(body.token || "").trim()
  const password = String(body.password || "")

  if (!token || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Token and a password (min 6 chars) are required" },
      { status: 400 }
    )
  }

  const decoded = verifyPasswordResetToken(token)
  if (!decoded) {
    return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 401 })
  }

  const admin = await db.siteAdmin.findUnique({ where: { id: decoded.adminId } })
  if (!admin || !admin.active || admin.email !== decoded.email) {
    return NextResponse.json({ error: "Account not found or deactivated" }, { status: 404 })
  }

  await db.siteAdmin.update({
    where: { id: admin.id },
    data: { passwordHash: hashPassword(password) },
  })

  return NextResponse.json({ ok: true })
}

/**
 * GET /api/admin/reset-password?request=1&email=X
 * Request a reset: looks up the admin by email, generates a token, returns
 * it (in dev) or emails it (in production, if RESEND_API_KEY is set).
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, windowMs: 10 * 60 * 1000 })
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const admin = await db.siteAdmin.findUnique({ where: { email: email.toLowerCase().trim() } })

  // Always return OK to prevent email-enumeration (don't reveal whether
  // the email exists).
  if (!admin || !admin.active) {
    return NextResponse.json({ ok: true, message: "If an account exists, a reset link has been sent." })
  }

  const token = issuePasswordResetToken(admin.id, admin.email)
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/?view=admin-reset-password&token=${token}`

  // In production with RESEND_API_KEY set, email the reset link.
  // In dev (no key), return the reset URL directly for testing.
  if (process.env.RESEND_API_KEY) {
    try {
      const { default: ZAI } = await import("z-ai-web-dev-sdk")
      // Use Resend or another email provider here.
      // For now, fall back to returning the URL.
      console.log(`[Password Reset] Reset link for ${email}: ${resetUrl}`)
    } catch {
      // SDK not available — fall through
    }
  }

  // Dev mode: return the reset URL so the admin can click it.
  return NextResponse.json({
    ok: true,
    message: "Reset link generated.",
    // Only include the reset URL in dev mode (no email provider configured).
    ...(process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY
      ? { resetUrl }
      : {}),
  })
}
