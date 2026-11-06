"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { PLANS, type PlanKey } from "@/lib/stripe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, X, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export function PricingView() {
  const navigate = useAppStore((s) => s.navigate)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState<"pro" | "enterprise" | null>(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState<"success" | "canceled" | null>(null)

  // Check URL for status param (set by Stripe redirect)
  if (typeof window !== "undefined" && !status) {
    const params = new URLSearchParams(window.location.search)
    const s = params.get("status")
    if (s === "success" || s === "canceled") {
      setStatus(s)
    }
  }

  async function handleSubscribe(plan: "pro" | "enterprise") {
    setError("")
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }
    setLoading(plan)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.assign(data.url)
      } else {
        setError(data.error || "Failed to start checkout")
      }
    } catch {
      setError("Network error. Please try again.")
    }
    setLoading(null)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="font-display text-xs font-bold uppercase tracking-widest text-amber-600">
            Pricing Plans
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Choose Your Plan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start free. Upgrade when you need more. Cancel anytime.
        </p>
      </div>

      {/* Status messages */}
      {status === "success" && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
          ✓ Subscription successful! Your premium features are now active.
        </div>
      )}
      {status === "canceled" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
          Checkout was canceled. No charge was made.
        </div>
      )}

      {/* Email input */}
      <div className="mx-auto max-w-md">
        <label className="mb-1 block font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Your Email
        </label>
        <Input
          type="email"
          placeholder="you@league.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError("") }}
          className="h-10 text-sm"
        />
      </div>

      {error && (
        <p className="text-center text-sm font-medium text-red-600">{error}</p>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanKey[]).map((key) => {
          const plan = PLANS[key]
          const isPro = key === "pro"
          const isEnterprise = key === "enterprise"
          const isLoading = loading === key

          return (
            <div
              key={key}
              className={cn(
                "relative rounded-xl border-2 bg-white p-5 transition-all",
                isPro && "border-amber-400 shadow-lg shadow-amber-100",
                !isPro && "border-border",
              )}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5">
                  <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan name */}
              <h3 className="font-display text-xl font-black uppercase tracking-tight">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-3xl font-black">
                  ${plan.price}
                </span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>

              {/* Features */}
              <ul className="mt-4 space-y-2">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-foreground">{feat}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <div className="mt-5">
                {key === "free" ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("home")}
                  >
                    Get Started Free
                  </Button>
                ) : (
                  <Button
                    className={cn(
                      "w-full",
                      isPro && "bg-amber-500 text-white hover:bg-amber-600",
                      isEnterprise && "bg-[#1e2a5e] text-white hover:bg-[#283672]",
                    )}
                    disabled={isLoading || !email}
                    onClick={() => handleSubscribe(key as "pro" | "enterprise")}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Subscribe to ${plan.name}`
                    )}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Billing portal link */}
      <p className="text-center text-xs text-muted-foreground">
        Already subscribed?{" "}
        <button
          onClick={async () => {
            if (!email) { setError("Enter your email to manage your subscription"); return }
            try {
              const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              })
              const data = await res.json()
              if (data.url) window.location.assign(data.url)
              else setError(data.error || "No subscription found")
            } catch {
              setError("Network error")
            }
          }}
          className="font-bold text-amber-600 hover:text-amber-700"
        >
          Manage your subscription →
        </button>
      </p>

      {/* FAQ */}
      <div className="mx-auto max-w-2xl space-y-2 pt-4">
        <h4 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Frequently Asked Questions
        </h4>
        <details className="rounded-lg border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium">Can I switch plans later?</summary>
          <p className="mt-2 text-muted-foreground">Yes — upgrade or downgrade anytime via the billing portal. Changes take effect immediately.</p>
        </details>
        <details className="rounded-lg border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium">Is there a free trial?</summary>
          <p className="mt-2 text-muted-foreground">The Free plan is free forever. Paid plans can be canceled anytime — you keep access until the end of your billing period.</p>
        </details>
        <details className="rounded-lg border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium">What payment methods do you accept?</summary>
          <p className="mt-2 text-muted-foreground">All major credit cards via Stripe. Enterprise customers can pay by invoice.</p>
        </details>
      </div>
    </div>
  )
}
