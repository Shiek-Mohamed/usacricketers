import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { hashPassword, isValidEmail, requireSiteAdmin } from "@/lib/scorer-auth"
import { serializeScorer } from "@/lib/serialize"

export const dynamic = "force-dynamic"

// GET /api/scorers/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const scorer = await db.scorer.findUnique({
    where: { id },
    include: { assignments: true },
  })
  if (!scorer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(serializeScorer(scorer))
}

// PUT /api/scorers/:id  body: { name?, email?, active?, password?, tournamentIds?: string[] }
// If tournamentIds is provided, assignments are fully replaced (delete-all +
// re-create). Password is re-hashed only if a non-empty `password` is sent.
// Email is mandatory — can't be cleared.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: {
    name?: string
    email?: string
    active?: boolean
    password?: string
    tournamentIds?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const existing = await db.scorer.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updateData: {
    name?: string
    email?: string
    active?: boolean
    passwordHash?: string
  } = {}
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim()
  }
  if (body.email !== undefined) {
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
        await tx.scorer.update({ where: { id }, data: updateData })
      }
      if (Array.isArray(body.tournamentIds)) {
        // deleteMany first, so no existing assignments remain — duplicates are
        // only possible within the input itself, hence dedupe (SQLite's
        // createMany doesn't support skipDuplicates).
        await tx.scorerAssignment.deleteMany({ where: { scorerId: id } })
        const seriesIds = Array.from(
          new Set(body.tournamentIds.filter(Boolean))
        )
        if (seriesIds.length > 0) {
          await tx.scorerAssignment.createMany({
            data: seriesIds.map((seriesId) => ({ scorerId: id, seriesId })),
          })
        }
      }
    })

    const updated = await db.scorer.findUniqueOrThrow({
      where: { id },
      include: { assignments: true },
    })
    return NextResponse.json(serializeScorer(updated))
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

// DELETE /api/scorers/:id — cascade removes ScorerAssignment rows.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    await db.scorer.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
