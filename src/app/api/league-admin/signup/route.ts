import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  hashPassword,
  issueEmailVerificationToken,
  isValidEmail,
} from "@/lib/scorer-auth"
import { rateLimit } from "@/lib/rate-limit"
import { sendVerificationEmail, getBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

const FORMATS = ["T20", "ODI", "Test", "T10"] as const
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

function badField(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/**
 * Public self-sign-up — anyone can create a league-admin account + their first
 * league without the site admin's involvement. Rate-limited per IP to slow
 * abuse; the site admin retains the `active` lever to deactivate bad actors
 * after the fact.
 *
 * After signup, a verification email is sent to the provided email. The
 * account is created with emailVerifiedAt=null — login is blocked until
 * the user clicks the verification link. The old behavior (auto-login on
 * signup) was a security gap because it let anyone sign up with a fake
 * email and immediately access the league-admin dashboard.
 */
export async function POST(req: NextRequest) {
  // Rate-limit: 5 sign-ups per IP per hour.
  const limited = rateLimit(req, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (limited) return limited

  let body: {
    name?: string
    email?: string
    username?: string
    password?: string
    leagueName?: string
    leagueFormat?: string
    leagueSeason?: string
  }
  try {
    body = await req.json()
  } catch {
    return badField("Invalid JSON")
  }

  const name = String(body.name || "").trim()
  const email = String(body.email || "").trim()
  const username = String(body.username || "").trim()
  const password = String(body.password || "")
  const leagueName = String(body.leagueName || "").trim()
  const leagueFormat = String(body.leagueFormat || "T20")
  const leagueSeason =
    String(body.leagueSeason || "").trim() || String(new Date().getFullYear())

  // Validation
  if (!name) return badField("Your name is required")
  if (!USERNAME_RE.test(username))
    return badField("Username must be 3-30 chars (letters, numbers, underscore)")
  if (password.length < 6)
    return badField("Password must be at least 6 characters")
  if (!leagueName) return badField("League name is required")
  if (!FORMATS.includes(leagueFormat as (typeof FORMATS)[number]))
    return badField(`Format must be one of: ${FORMATS.join(", ")}`)
  if (!isValidEmail(email))
    return badField("A valid email is required")

  try {
    const result = await db.$transaction(async (tx) => {
      // Check username + email uniqueness inside the tx (race-safe-ish; the
      // @unique constraints also enforce at the DB level → P2002 below).
      const existingByUsername = await tx.leagueAdmin.findUnique({
        where: { username },
      })
      if (existingByUsername) throw new Error("USERNAME_TAKEN")
      const existingByEmail = await tx.leagueAdmin.findUnique({
        where: { email },
      })
      if (existingByEmail) throw new Error("EMAIL_TAKEN")

      // Create the league-admin account (emailVerifiedAt defaults to null —
      // the user must click the verification link before they can log in).
      const admin = await tx.leagueAdmin.create({
        data: {
          username,
          email,
          passwordHash: hashPassword(password),
          name,
          active: true,
        },
      })

      // Create their first league (Series). Auto-derive a shortName.
      const shortName =
        leagueName
          .replace(/[^a-zA-Z0-9]/g, " ")
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 6) || leagueName.slice(0, 6)
      const now = new Date()
      const series = await tx.series.create({
        data: {
          name: leagueName,
          shortName,
          format: leagueFormat,
          season: leagueSeason,
          startDate: now,
          endDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90),
          status: "upcoming",
          description: "",
        },
      })

      // Auto-assign the new admin as the owner of this league.
      await tx.leagueAdminAssignment.create({
        data: { adminId: admin.id, seriesId: series.id },
      })

      return { admin, series }
    })

    // Issue an email-verification token (24-hour TTL) and send the email.
    // The user can't log in until they click the link.
    const verifyToken = issueEmailVerificationToken(
      result.admin.id,
      result.admin.email!,
    )
    const verifyUrl = `${getBaseUrl()}/api/league-admin/verify-email?token=${encodeURIComponent(verifyToken)}`
    const emailResult = await sendVerificationEmail({
      to: result.admin.email!,
      name: result.admin.name,
      verifyUrl,
    })

    if (!emailResult.ok) {
      // The account was created but the verification email failed to send.
      // Log it but don't roll back — the user can request a resend via
      // /api/league-admin/resend-verification. Return a 201 with a hint.
      console.error(
        `[signup] email send failed for ${result.admin.email}: ${emailResult.error}`
      )
      return NextResponse.json(
        {
          admin: {
            id: result.admin.id,
            name: result.admin.name,
            username: result.admin.username,
            email: result.admin.email,
          },
          managedSeriesIds: [result.series.id],
          needsEmailVerification: true,
          emailSent: false,
          message:
            "Account created but the verification email failed to send. Use the 'Resend verification email' link on the login page.",
        },
        { status: 201 }
      )
    }

    // Success — return account info + hint that the user must verify their
    // email before they can log in. The frontend should show a "Check your
    // email" success state instead of auto-logging in.
    return NextResponse.json(
      {
        admin: {
          id: result.admin.id,
          name: result.admin.name,
          username: result.admin.username,
          email: result.admin.email,
        },
        managedSeriesIds: [result.series.id],
        needsEmailVerification: true,
        emailSent: true,
        emailDevMode: emailResult.devMode === true,
        message: emailResult.devMode
          ? "Account created. (Dev mode: check the server log for the verification link.)"
          : "Account created. Check your email for a verification link before logging in.",
      },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "USERNAME_TAKEN")
        return NextResponse.json(
          { error: "That username is taken" },
          { status: 409 }
        )
      if (e.message === "EMAIL_TAKEN")
        return NextResponse.json(
          { error: "An account with that email already exists" },
          { status: 409 }
        )
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const target = (e.meta?.target as string[] | undefined)?.[0]
      if (target === "email")
        return NextResponse.json(
          { error: "An account with that email already exists" },
          { status: 409 }
        )
      return NextResponse.json(
        { error: "That username is taken" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: String(e).slice(0, 200) },
      { status: 500 }
    )
  }
}
