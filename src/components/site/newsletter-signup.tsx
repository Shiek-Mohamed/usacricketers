"use client"

import { useState } from "react"
import { Mail, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Status = "idle" | "loading" | "success" | "error"

/**
 * NewsletterSignup — reusable email capture component.
 *
 * Two variants:
 *   - "footer"  : compact, dark-background (sits in the site footer)
 *   - "inline"  : card-style, light-background (sits in the homepage feed)
 *
 * POSTs to the existing /api/newsletter/subscribe endpoint (which uses
 * raw SQL to work around the Prisma 6.x DateTime bug on the
 * NewsletterSubscriber table).
 */
export function NewsletterSignup({
  variant = "footer",
  className,
}: {
  variant?: "footer" | "inline"
  className?: string
}) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error")
      setMessage("Please enter a valid email address")
      return
    }
    setStatus("loading")
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("success")
        setMessage(data.message || "You're subscribed!")
        setEmail("")
      } else {
        setStatus("error")
        setMessage(data.error || "Something went wrong. Please try again.")
      }
    } catch {
      setStatus("error")
      setMessage("Network error. Please try again.")
    }
  }

  const isFooter = variant === "footer"

  return (
    <div
      className={cn(
        isFooter ? "w-full" : "rounded-lg border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Mail className={cn("h-4 w-4", isFooter ? "text-amber-400" : "text-red-600")} />
        <h3
          className={cn(
            "text-sm font-bold uppercase tracking-wide",
            isFooter ? "text-white" : "text-foreground",
          )}
        >
          {isFooter ? "Newsletter" : "Get the latest USA cricket news"}
        </h3>
      </div>
      <p
        className={cn(
          "mt-1.5 text-[13px] leading-relaxed",
          isFooter ? "text-white/70" : "text-muted-foreground",
        )}
      >
        {isFooter
          ? "Live scores, match reports & exclusive interviews — delivered to your inbox."
          : "Join other cricket fans. Get a weekly digest of the biggest stories, live score alerts for USA matches, and exclusive interviews."}
      </p>

      {status === "success" ? (
        <div
          className={cn(
            "mt-3 flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-medium",
            isFooter
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <Input
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status === "error") setStatus("idle")
            }}
            disabled={status === "loading"}
            aria-label="Email address"
            className={cn(
              "h-9 flex-1 text-sm",
              isFooter &&
                "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:bg-white/15",
            )}
          />
          <Button
            type="submit"
            disabled={status === "loading"}
            className={cn(
              "h-9 shrink-0 text-sm font-semibold",
              isFooter
                ? "bg-amber-400 text-[#1e2a5e] hover:bg-amber-300"
                : "bg-red-600 text-white hover:bg-red-700",
            )}
          >
            {status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Subscribe"
            )}
          </Button>
        </form>
      )}

      {status === "error" && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 text-[12px]",
            isFooter ? "text-red-300" : "text-red-600 dark:text-red-400",
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <p
        className={cn(
          "mt-2 text-[11px]",
          isFooter ? "text-white/40" : "text-muted-foreground/70",
        )}
      >
        No spam. Unsubscribe anytime.
      </p>
    </div>
  )
}
