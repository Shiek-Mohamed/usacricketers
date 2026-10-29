import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { issueEmailVerificationToken } from "@/lib/scorer-auth"
import { rateLimit } from "@/lib/rate-limit"
import { sendVerificationEmail, getBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * POST /api/league-admin/resend-verification
 *
 * Body: { email: string } OR { username: string }
 *
 * Looks up the league admin by email or username, and if their email is
 * not yet verified, re-issues a fresh verification token + resends the
 * email. Idempotent: if the email is already verified, returns success
 * without sending (avoids leaking the verified state to anonymous callers).
 *
 * Rate-limited: 3 per hour per IP (tighter than signup because the email
 * is going to a real inbox, not just creating a DB record).
 */
export async function POST(req: NextRequest) {
  // Rate-limit: 3 resend attempts per IP per hour.
  const limited = rateLimit(req, { limit: 3, windowMs: 60 * 60 * 1000 })
  if (limited) return limited

  try {
    const body = await req.json()
    const email = String(body.email || "").trim().toLowerCase()
    const username = String(body.username || "").trim()

    if (!email && !username) {
      return NextResponse.json(
        { error: "Email or username is required" },
        { status: 400 }
      )
    }

    // Look up by email OR username (whichever was provided)
    const admin = email
      ? await db.leagueAdmin.findUnique({ where: { email } })
      : await db.leagueAdmin.findUnique({ where: { username } })

    // Don't leak whether the account exists — return the same success
    // message regardless. The "if you don't see an email" copy covers
    // the not-found case.
    if (!admin || !admin.email) {
      return NextResponse.json({
        ok: true,
        message:
          "If an account with that email exists and isn't yet verified, a new verification link has been sent.",
      })
    }

    // Idempotent: if already verified, return success without sending.
    if (admin.emailVerifiedAt !== null) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        message: "Your email is already verified. You can log in.",
      })
    }

    // Issue a fresh token + send the verification email
    const verifyToken = issueEmailVerificationToken(admin.id, admin.email)
    const verifyUrl = `${getBaseUrl()}/api/league-admin/verify-email?token=${encodeURIComponent(verifyToken)}`
    const emailResult = await sendVerificationEmail({
      to: admin.email,
      name: admin.name,
      verifyUrl,
    })

    if (!emailResult.ok) {
      console.error(
        `[resend-verification] email send failed for ${admin.email}: ${emailResult.error}`
      )
      return NextResponse.json(
        {
          ok: false,
          error:
            "Failed to send verification email. Please try again later or contact support.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      emailSent: true,
      emailDevMode: emailResult.devMode === true,
      message: emailResult.devMode
        ? "Verification email (re)generated. (Dev mode: check the server log for the verification link.)"
        : "Verification email sent. Check your inbox (and spam folder).",
    })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
