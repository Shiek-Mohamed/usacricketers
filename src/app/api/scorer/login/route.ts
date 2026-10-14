import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword, issueScorerToken } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

// POST /api/scorer/login  body: { username, password }
// Returns { scorer:{id,name,username}, token, tournamentIds } or 401.
export async function POST(req: Request) {
  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const username = body.username?.trim()
  const password = body.password ?? ""
  if (!username || !password) {
    return NextResponse.json(
      { error: "Missing username or password" },
      { status: 400 }
    )
  }

  const scorer = await db.scorer.findUnique({
    where: { username },
    include: { assignments: true },
  })

  if (
    !scorer ||
    !verifyPassword(password, scorer.passwordHash) ||
    !scorer.active
  ) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const tournamentIds = scorer.assignments.map((a) => a.seriesId)
  const token = issueScorerToken({
    scorerId: scorer.id,
    name: scorer.name,
    username: scorer.username,
    tournamentIds,
  })

  return NextResponse.json({
    scorer: {
      id: scorer.id,
      name: scorer.name,
      username: scorer.username,
    },
    token,
    tournamentIds,
  })
}
