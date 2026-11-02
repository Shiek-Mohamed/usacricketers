import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// POST /api/feedback — submit user feedback
// Body: { name?, email?, category, message }
// Uses raw SQL for the insert (Prisma 6.x DateTime bug on SQLite).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const category = String(body.category || "General").trim()
    const message = String(body.message || "").trim()
    if (!message || message.length < 10) {
      return NextResponse.json({ error: "Message must be at least 10 characters" }, { status: 400 })
    }
    const id = randomUUID()
    const nowIso = new Date().toISOString()
    const page = typeof window !== "undefined" ? window.location.href : ""
    await db.$executeRawUnsafe(
      `INSERT INTO "Feedback" (id, name, email, category, message, page, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, name, email, category, message, page, nowIso
    )
    return NextResponse.json({ ok: true, message: "Feedback received" }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
