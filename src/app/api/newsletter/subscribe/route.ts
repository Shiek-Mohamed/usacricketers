import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// POST /api/newsletter/subscribe — captures email for newsletter.
// Body: { email: string }
// Uses raw SQL for the insert (Prisma 6.x mishandles DateTime for SQLite
// on some tables — the @default(now()) createdAt gets serialized as an
// integer that can't be read back via RETURNING).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || "").trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }
    // Check if already subscribed (SELECT — no DateTime issue).
    const existing = await db.$queryRawUnsafe(
      `SELECT id FROM "NewsletterSubscriber" WHERE email = ? LIMIT 1`,
      email
    )
    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ ok: true, message: "Already subscribed!" })
    }
    // Insert via raw SQL with explicit ISO string for createdAt.
    const id = randomUUID()
    const nowIso = new Date().toISOString()
    await db.$executeRawUnsafe(
      `INSERT INTO "NewsletterSubscriber" (id, email, createdAt) VALUES (?, ?, ?)`,
      id, email, nowIso
    )
    return NextResponse.json({ ok: true, message: "Subscribed!" }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
