import { NextRequest, NextResponse } from "next/server"
import { calculateDLS } from "@/lib/dls"

export const dynamic = "force-dynamic"

/** POST /api/dls — calculate DLS revised target.
 *  Body: { team1Runs, team1Overs, team1Wickets, team2Runs, team2OversFaced,
 *          team2Wickets, totalOvers, revisedOvers, g50? }
 *  Returns: DLSResult */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = calculateDLS(
      Number(body.team1Runs) || 0,
      Number(body.team1Overs) || 0,
      Number(body.team1Wickets) || 0,
      Number(body.team2Runs) || 0,
      Number(body.team2OversFaced) || 0,
      Number(body.team2Wickets) || 0,
      Number(body.totalOvers) || 50,
      Number(body.revisedOvers) || 50,
      Number(body.g50) || 245,
    )
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
