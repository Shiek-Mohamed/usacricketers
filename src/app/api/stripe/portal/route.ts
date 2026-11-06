import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/** POST /api/stripe/portal — redirects to Stripe's self-service billing
 *  portal where subscribers can update their payment method, change plans,
 *  or cancel their subscription.
 *
 *  Body: { email: string }
 *  Returns: { url: string } — redirect URL for Stripe Billing Portal */
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
    }

    const body = await req.json()
    const email = String(body.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    // Find the Stripe customer ID from our DB
    const sub = await db.subscription.findFirst({
      where: { email },
    })
    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found for this email" },
        { status: 404 },
      )
    }

    const origin = req.headers.get("origin") || "https://usacricketers.fly.dev"

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/?view=pricing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
