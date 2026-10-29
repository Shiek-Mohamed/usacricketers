import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyEmailVerificationToken } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/league-admin/verify-email?token=XXX
 *
 * Called when a league admin clicks the verification link in their email.
 * Verifies the signed token, looks up the admin, marks emailVerifiedAt=now().
 *
 * Returns a simple HTML page (not a redirect — the app uses Zustand store
 * nav which doesn't read URL query strings). The page shows success/failure
 * + a button to go to the home page where they can navigate to login.
 *
 * Idempotent: clicking the link twice doesn't error — the second click
 * just sees emailVerifiedAt is already set and shows the same success page.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") || ""
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  // Verify the token signature + TTL
  const payload = verifyEmailVerificationToken(token)
  if (!payload) {
    return htmlResponse(
      "Verification link invalid or expired",
      "The link you clicked is invalid, expired (24-hour TTL), or already used to reset your password. Please request a new verification email.",
      baseUrl,
      false,
    )
  }

  // Look up the admin by ID
  const admin = await db.leagueAdmin.findUnique({
    where: { id: payload.adminId },
  })
  if (!admin) {
    return htmlResponse(
      "Account not found",
      "We couldn't find an account matching this verification link. It may have been deleted. Please sign up again.",
      baseUrl,
      false,
    )
  }

  // Check the email still matches (in case the admin updated their email
  // after this token was issued — old tokens shouldn't verify new emails)
  if (admin.email !== payload.email) {
    return htmlResponse(
      "Verification link invalid",
      "This verification link doesn't match your current email. If you recently changed your email, please use the verification link sent to your new address.",
      baseUrl,
      false,
    )
  }

  // Idempotent: if already verified, show the same success page
  if (admin.emailVerifiedAt !== null) {
    return htmlResponse(
      "Email already verified",
      `Your email (${admin.email}) is already verified. You can log in to your league admin account.`,
      baseUrl,
      true,
    )
  }

  // Mark as verified
  await db.leagueAdmin.update({
    where: { id: admin.id },
    data: { emailVerifiedAt: new Date() },
  })

  return htmlResponse(
    "Email verified ✓",
    `Thanks ${admin.name} — your email (${admin.email}) is now verified. You can log in to your league admin account.`,
    baseUrl,
    true,
  )
}

/** Helper: render a simple HTML page (no SPA navigation needed). */
function htmlResponse(
  title: string,
  message: string,
  baseUrl: string,
  success: boolean,
): NextResponse {
  const accentColor = success ? "#15803d" : "#b91c1c" // emerald-700 / red-700
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — USACricketers</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1e293b; line-height: 1.5;">
  <h1 style="color: ${accentColor}; font-size: 24px; margin: 0 0 16px 0;">${escapeHtml(title)}</h1>
  <p style="margin: 0 0 24px 0;">${escapeHtml(message)}</p>
  <a href="${escapeAttr(baseUrl)}" style="background: #b91c1c; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600;">Go to USACricketers</a>
  <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">— USACricketers</p>
</body>
</html>`
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
