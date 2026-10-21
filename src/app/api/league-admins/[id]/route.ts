import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { hashPassword, isValidEmail, requireSiteAdmin } from "@/lib/scorer-auth"
import { serializeLeagueAdmin } from "@/lib/serialize"

export const dynamic = "force-dynamic"

// GET /api/league-admins/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const adminRec = await db.leagueAdmin.findUnique({
    where: { id },
    include: { assignments: true },
  })
  if (!adminRec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(serializeLeagueAdmin(adminRec))
}

// PUT /api/league-admins/:id  body: { name?, email?, active?, password?, managedSeriesIds?: string[] }
// If managedSeriesIds is provided, assignments are fully replaced (delete-all +
// re-create). Password is re-hashed only if a non-empty `password` is sent.
// Pass email: null to clear it.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: {
    name?: string
    email?: string | null
    active?: boolean
    password?: string
    managedSeriesIds?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const existing = await db.leagueAdmin.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updateData: {
    name?: string
    email?: string | null
    active?: boolean
    passwordHash?: string
  } = {}
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim()
  }
  if (body.email !== undefined) {
    // Email is mandatory — can't be cleared.
    if (!isValidEmail(body.email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      )
    }
    updateData.email = body.email.trim()
  }
  if (typeof body.active === "boolean") {
    updateData.active = body.active
  }
  if (typeof body.password === "string" && body.password) {
    updateData.passwordHash = hashPassword(body.password)
  }

  try {
    await db.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.leagueAdmin.update({ where: { id }, data: updateData })
      }
      if (Array.isArray(body.managedSeriesIds)) {
        await tx.leagueAdminAssignment.deleteMany({ where: { adminId: id } })
        const seriesIds = Array.from(
          new Set(body.managedSeriesIds.filter(Boolean))
        )
        if (seriesIds.length > 0) {
          await tx.leagueAdminAssignment.createMany({
            data: seriesIds.map((seriesId) => ({ adminId: id, seriesId })),
          })
        }
      }
    })

    const updated = await db.leagueAdmin.findUniqueOrThrow({
      where: { id },
      include: { assignments: true },
    })
    return NextResponse.json(serializeLeagueAdmin(updated))
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
    return NextResponse.json(
      { error: String(err).slice(0, 200) },
      { status: 500 }
    )
  }
}

// DELETE /api/league-admins/:id — cascade removes LeagueAdminAssignment rows.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    await db.leagueAdmin.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
