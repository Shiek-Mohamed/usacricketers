import Stripe from "stripe"

/** Stripe client — initialized lazily so the app doesn't crash if
 *  STRIPE_SECRET_KEY isn't set (e.g. during development without Stripe). */
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  stripeInstance = new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  })
  return stripeInstance
}

/** Plan definitions — used by the pricing UI + feature gating. */
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceId: null,
    features: [
      "1 league / competition",
      "Up to 10 teams",
      "Basic live scoring",
      "Public scorecards",
      "usacricketers subdomain",
    ],
    limits: {
      maxLeagues: 1,
      maxTeams: 10,
      customBranding: false,
      customDomain: false,
      adFree: false,
      apiAccess: false,
    },
  },
  pro: {
    name: "Pro",
    price: 29,
    priceId: process.env.STRIPE_PRICE_PRO || null,
    features: [
      "Unlimited leagues & teams",
      "Custom branding (logo, colors)",
      "Custom domain support",
      "Ad-free experience",
      "Player rankings & leaderboards",
      "Tournament brackets",
      "DLS calculator",
      "Priority email support",
    ],
    limits: {
      maxLeagues: Infinity,
      maxTeams: Infinity,
      customBranding: true,
      customDomain: true,
      adFree: true,
      apiAccess: false,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
    features: [
      "Everything in Pro",
      "Multi-division support",
      "White-label (remove USACricketers branding)",
      "API access (ball-by-ball data feeds)",
      "Advanced analytics & wagon wheels",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    limits: {
      maxLeagues: Infinity,
      maxTeams: Infinity,
      customBranding: true,
      customDomain: true,
      adFree: true,
      apiAccess: true,
    },
  },
} as const

export type PlanKey = keyof typeof PLANS
