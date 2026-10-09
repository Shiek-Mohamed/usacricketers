import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeSeries } from "@/lib/serialize"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const s = await db.series.findUnique({ where: { id } })
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(serializeSeries(s))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const s = await db.series.update({
    where: { id },
    data: {
      name: body.name,
      shortName: body.shortName,
      format: body.format,
      season: body.season,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      status: body.status,
      description: body.description,
    },
  })
  return NextResponse.json(serializeSeries(s))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await db.series.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
