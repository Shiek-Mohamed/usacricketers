import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeMatch } from "@/lib/serialize"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "0", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "0", 10)

  const where = status ? { status } : undefined

  // Backward-compatible: when page + pageSize are NOT provided, return the
  // full flat array (like before). When they ARE provided, return a
  // paginated response with { items, total, page, pageSize, totalPages }.
  const paginate = page > 0 && pageSize > 0

  if (paginate) {
    const [matches, total] = await Promise.all([
      db.match.findMany({
        where,
        include: { team1: true, team2: true, series: true },
        orderBy: { startDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.match.count({ where }),
    ])
    const res = NextResponse.json({
      items: matches.map(serializeMatch),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
    return res
  }

  // Flat response (backward-compatible)
  const matches = await db.match.findMany({
    where,
    include: { team1: true, team2: true, series: true },
    orderBy: { startDate: "desc" },
    take: 200, // safety cap to prevent huge responses
  })
  const res = NextResponse.json(matches.map(serializeMatch))
  res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
  return res
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json()
  const match = await db.match.create({
    data: {
      seriesId: body.seriesId || null,
      team1Id: body.team1Id,
      team2Id: body.team2Id,
      format: body.format || "ODI",
      matchNo: body.matchNo || "1st Match",
      status: body.status || "upcoming",
      venue: body.venue || "",
      city: body.city || "",
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      result: body.result || "",
      manOfMatch: body.manOfMatch || null,
      umpires: body.umpires || "",
      tvUmpire: body.tvUmpire || "",
      referee: body.referee || "",
      scorecard:
        typeof body.scorecard === "string"
          ? body.scorecard
          : body.scorecard
          ? JSON.stringify(body.scorecard)
          : "",
    },
    include: { team1: true, team2: true, series: true },
  })
  return NextResponse.json(serializeMatch(match), { status: 201 })
}
