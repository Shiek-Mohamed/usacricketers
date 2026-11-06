import { NextRequest, NextResponse } from "next/server"
import { getStripe, PLANS } from "@/lib/stripe"

export const dynamic = "force-dynamic"

/** POST /api/stripe/checkout — creates a Stripe Checkout session for
 *  subscribing to a paid plan.
 *  Body: { plan: "pro" | "enterprise", email: string }
 *  Returns: { url: string } — redirect URL for Stripe Checkout */
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." },
        { status: 503 },
      )
    }

    const body = await req.json()
    const plan = body.plan as "pro" | "enterprise"
    const email = String(body.email || "").trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 })
    }

    const planConfig = PLANS[plan]
    if (!planConfig?.priceId) {
      return NextResponse.json(
        { error: `Plan "${plan}" is not configured. Set STRIPE_PRICE_${plan.toUpperCase()}.` },
        { status: 503 },
      )
    }

    const origin = req.headers.get("origin") || "https://usacricketers.fly.dev"

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${origin}/?view=pricing&status=success`,
      cancel_url: `${origin}/?view=pricing&status=canceled`,
      metadata: { email, plan },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 })
  }
}
