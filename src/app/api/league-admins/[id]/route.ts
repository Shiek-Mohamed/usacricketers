import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/scorer-auth"
import { serializeLeagueAdmin } from "@/lib/serialize"

export const dynamic = "force-dynamic"

// GET /api/league-admins/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await db.leagueAdmin.findUnique({
    where: { id },
    include: { assignments: true },
  })
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(serializeLeagueAdmin(admin))
}

// PUT /api/league-admins/:id  body: { name?, active?, password?, managedSeriesIds?: string[] }
// If managedSeriesIds is provided, assignments are fully replaced (delete-all +
// re-create). Password is re-hashed only if a non-empty `password` is sent.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: {
    name?: string
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
    active?: boolean
    passwordHash?: string
  } = {}
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim()
  }
  if (typeof body.active === "boolean") {
    updateData.active = body.active
  }
  if (typeof body.password === "string" && body.password) {
    updateData.passwordHash = hashPassword(body.password)
  }

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
}

// DELETE /api/league-admins/:id — cascade removes LeagueAdminAssignment rows.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await db.leagueAdmin.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
