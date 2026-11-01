import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { serializeSeries, serializeTeam } from "@/lib/serialize"
import { cacheDelPrefix } from "@/lib/cache"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export async function GET() {
  const series = await db.series.findMany({
    orderBy: { startDate: "desc" },
    include: { tournamentTeams: { include: { team: true } } },
  })
  const res = NextResponse.json(series.map(serializeSeries))
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  )
  return res
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  // Raw SQL insert — Prisma 6.x mishandles Date objects for SQLite
  // (series.create → INSERT ... RETURNING fails on DateTime). ISO string
  // params bypass this; reads via findUnique work fine.
  const id = randomUUID()
  const startIso = (body.startDate ? new Date(body.startDate) : new Date()).toISOString()
  const endIso = (body.endDate ? new Date(body.endDate) : new Date()).toISOString()
  const nowIso = new Date().toISOString()
  await db.$executeRawUnsafe(
    `INSERT INTO "Series" (id, name, shortName, format, season, startDate, endDate, status, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, body.name, body.shortName, body.format || "ODI", body.season || "2025",
    startIso, endIso, body.status || "upcoming", body.description || "", nowIso, nowIso,
  )
  const s = await db.series.findUnique({
    where: { id },
    include: { tournamentTeams: { include: { team: true } } },
  })
  cacheDelPrefix("series:list")
  return NextResponse.json(serializeSeries(s), { status: 201 })
}
