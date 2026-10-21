import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { hashPassword, isValidEmail, requireSiteAdmin } from "@/lib/scorer-auth"
import { serializeScorer } from "@/lib/serialize"

export const dynamic = "force-dynamic"

// GET /api/scorers — list all scorer accounts with their assignments.
// Site-admin only — scorer accounts are private.
export async function GET(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const scorers = await db.scorer.findMany({
    include: { assignments: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(scorers.map(serializeScorer))
}

// POST /api/scorers  body: { username, email, password, name, active?, tournamentIds?: string[] }
export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: {
    username?: string
    email?: string
    password?: string
    name?: string
    active?: boolean
    tournamentIds?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const username = body.username?.trim()
  const email = body.email?.trim()
  const password = body.password ?? ""
  const name = body.name?.trim()
  if (!username || !password || !name) {
    return NextResponse.json(
      { error: "username, password and name are required" },
      { status: 400 }
    )
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    )
  }

  // Dedupe tournamentIds (SQLite's createMany doesn't support skipDuplicates;
  // the @@unique([scorerId, seriesId]) constraint would otherwise throw).
  const tournamentIds = Array.isArray(body.tournamentIds)
    ? Array.from(new Set(body.tournamentIds.filter(Boolean)))
    : []
  const active = body.active ?? true
  const passwordHash = hashPassword(password)

  try {
    const created = await db.$transaction(async (tx) => {
      const scorer = await tx.scorer.create({
        data: { username, email, passwordHash, name, active },
      })
      if (tournamentIds.length > 0) {
        await tx.scorerAssignment.createMany({
          data: tournamentIds.map((seriesId) => ({
            scorerId: scorer.id,
            seriesId,
          })),
        })
      }
      return tx.scorer.findUniqueOrThrow({
        where: { id: scorer.id },
        include: { assignments: true },
      })
    })

    return NextResponse.json(serializeScorer(created), { status: 201 })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[] | undefined)?.[0]
      const msg =
        target === "email"
          ? "An account with that email already exists"
          : "Username already exists"
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    throw err
  }
}
