import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// POST /api/newsletter/subscribe — captures email for newsletter.
// Body: { email: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || "").trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }
    // Check if already subscribed
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ ok: true, message: "Already subscribed!" })
    }
    // Insert via Prisma create (PostgreSQL handles DateTime correctly)
    await db.newsletterSubscriber.create({
      data: { email },
    })
    return NextResponse.json({ ok: true, message: "Subscribed!" }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
