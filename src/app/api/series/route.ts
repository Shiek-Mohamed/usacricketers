import { NextRequest, NextResponse } from "next/server"
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
  const s = await db.series.create({
    data: {
      name: body.name,
      shortName: body.shortName,
      format: body.format || "ODI",
      season: body.season || "2025",
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : new Date(),
      status: body.status || "upcoming",
      description: body.description || "",
      ballType: body.ballType || "Leather",
      category: body.category || "Men",
      level: body.level || "Club",
      playersPerTeam: body.playersPerTeam ? Number(body.playersPerTeam) : 11,
      squadLimit: body.squadLimit ? Number(body.squadLimit) : 0,
      logoUrl: body.logoUrl || null,
      winPoints: body.winPoints !== undefined ? Number(body.winPoints) : 2,
      lossPoints: body.lossPoints !== undefined ? Number(body.lossPoints) : 0,
      tiePoints: body.tiePoints !== undefined ? Number(body.tiePoints) : 1,
      abandonedPoints: body.abandonedPoints !== undefined ? Number(body.abandonedPoints) : 1,
      bonusPoints: body.bonusPoints !== undefined ? Number(body.bonusPoints) : 0,
      rankCriteria: body.rankCriteria || "points,nrr,headToHead,wins,winPercentage",
    },
    include: { tournamentTeams: { include: { team: true } } },
  })
  cacheDelPrefix("series:list")
  return NextResponse.json(serializeSeries(s), { status: 201 })
}
