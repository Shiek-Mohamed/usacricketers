import { db } from "@/lib/db"
import { PLANS, type PlanKey } from "@/lib/stripe"

/** Get the subscription plan for an email address. Returns "free" if no
 *  active subscription exists. */
export async function getPlan(email: string): Promise<PlanKey> {
  if (!email) return "free"
  try {
    const sub = await db.subscription.findFirst({
      where: { email: email.toLowerCase() },
      orderBy: { createdAt: "desc" },
    })
    if (!sub || sub.status === "canceled" || sub.status === "unpaid") {
      return "free"
    }
    return sub.plan as PlanKey
  } catch {
    return "free"
  }
}

/** Check if a specific feature is enabled for a plan. */
export function hasFeature(plan: PlanKey, feature: string): boolean {
  const planConfig = PLANS[plan]
  if (!planConfig) return false
  // @ts-expect-error — feature is a dynamic key
  return planConfig.limits[feature] === true || planConfig.limits[feature] === Infinity
}

/** Get the plan limits for feature gating. */
export function getPlanLimits(plan: PlanKey) {
  return PLANS[plan]?.limits ?? PLANS.free.limits
}
