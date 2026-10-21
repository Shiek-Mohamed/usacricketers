import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/scorer-auth"
import { serializeLeagueAdmin } from "@/lib/serialize"

export const dynamic = "force-dynamic"

// GET /api/league-admins — list all league-admin accounts with their assignments.
// Site-admin level (matches the existing admin CMS pattern — no auth gate).
export async function GET() {
  const admins = await db.leagueAdmin.findMany({
    include: { assignments: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(admins.map(serializeLeagueAdmin))
}

// POST /api/league-admins  body: { username, password, name, email?, active?, managedSeriesIds?: string[] }
export async function POST(req: Request) {
  let body: {
    username?: string
    email?: string
    password?: string
    name?: string
    active?: boolean
    managedSeriesIds?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const username = body.username?.trim()
  const password = body.password ?? ""
  const name = body.name?.trim()
  const email = body.email?.trim() || null
  if (!username || !password || !name) {
    return NextResponse.json(
      { error: "username, password and name are required" },
      { status: 400 }
    )
  }

  // Dedupe managedSeriesIds (SQLite's createMany doesn't support skipDuplicates).
  const managedSeriesIds = Array.isArray(body.managedSeriesIds)
    ? Array.from(new Set(body.managedSeriesIds.filter(Boolean)))
    : []
  const active = body.active ?? true
  const passwordHash = hashPassword(password)

  try {
    const created = await db.$transaction(async (tx) => {
      const admin = await tx.leagueAdmin.create({
        data: { username, email, passwordHash, name, active },
      })
      if (managedSeriesIds.length > 0) {
        await tx.leagueAdminAssignment.createMany({
          data: managedSeriesIds.map((seriesId) => ({
            adminId: admin.id,
            seriesId,
          })),
        })
      }
      return tx.leagueAdmin.findUniqueOrThrow({
        where: { id: admin.id },
        include: { assignments: true },
      })
    })

    return NextResponse.json(serializeLeagueAdmin(created), { status: 201 })
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
