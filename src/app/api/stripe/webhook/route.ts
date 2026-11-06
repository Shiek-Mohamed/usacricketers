import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/** POST /api/stripe/webhook — handles Stripe webhook events.
 *
 *  Stripe sends events here when subscriptions are created, updated,
 *  payment succeeds, or subscriptions are canceled. This route verifies
 *  the Stripe signature, then updates the Subscription record in the DB.
 *
 *  Configure the webhook endpoint in Stripe Dashboard → Developers → Webhooks
 *  URL: https://usacricketers.fly.dev/api/stripe/webhook
 *  Events: checkout.session.completed, customer.subscription.updated,
 *          customer.subscription.deleted */
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 })
    }

    const body = await req.text()
    const signature = req.headers.get("stripe-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    // Verify the webhook signature (Stripe security)
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          customer: string
          customer_email?: string
          metadata?: { email?: string; plan?: string }
        }
        const email = (session.metadata?.email || session.customer_email || "").toLowerCase()
        const plan = session.metadata?.plan || "pro"
        const customerId = session.customer

        if (email && customerId) {
          // Upsert the subscription record
          await db.subscription.upsert({
            where: { stripeCustomerId: customerId },
            create: {
              email,
              stripeCustomerId: customerId,
              plan,
              status: "active",
            },
            update: {
              email,
              plan,
              status: "active",
            },
          })
        }
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as {
          id: string
          customer: string
          status: string
          current_period_end: number
        }
        const customerId = sub.customer

        // Determine plan from the price ID (lookup)
        // For now, use the metadata or default to "pro"
        const existing = await db.subscription.findUnique({
          where: { stripeCustomerId: customerId },
        })
        if (existing) {
          await db.subscription.update({
            where: { stripeCustomerId: customerId },
            data: {
              stripeSubId: sub.id,
              status: sub.status,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as { customer: string }
        const customerId = sub.customer

        await db.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: "canceled" },
        })
        break
      }

      default:
        // Unhandled event type — acknowledge receipt (Stripe requirement)
        break
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error("[stripe/webhook] Error:", e)
    return NextResponse.json(
      { error: String(e).slice(0, 200) },
      { status: 400 },
    )
  }
}
