import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { hashPassword, issueLeagueAdminToken, isValidEmail } from "@/lib/scorer-auth"
import { rateLimit } from "@/lib/rate-limit"

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

      // Create the league-admin account (email is mandatory).
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

    // Issue a signed session token (same shape as login).
    const token = issueLeagueAdminToken({
      adminId: result.admin.id,
      name: result.admin.name,
      username: result.admin.username,
      managedSeriesIds: [result.series.id],
    })

    return NextResponse.json(
      {
        admin: {
          id: result.admin.id,
          name: result.admin.name,
          username: result.admin.username,
        },
        token,
        managedSeriesIds: [result.series.id],
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
