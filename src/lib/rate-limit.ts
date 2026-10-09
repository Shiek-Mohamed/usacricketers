import { NextRequest, NextResponse } from "next/server"

/**
 * Lightweight in-process token-bucket rate limiter keyed by IP.
 *
 * Usage in a route handler:
 *   const limited = rateLimit(req, { limit: 60, windowMs: 60_000 })
 *   if (limited) return limited
 *
 * Process-local (no Redis) — good enough to protect a single instance from
 * burst abuse; for multi-instance deploys use a shared store.
 */

interface Bucket {
  tokens: number
  refillAt: number
}

const buckets = new Map<string, Bucket>()

// Background sweep of stale buckets.
let sweeper: ReturnType<typeof setInterval> | null = null
function ensureSweeper() {
  if (sweeper || typeof setInterval === "undefined") return
  sweeper = setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
      if (b.refillAt <= now) buckets.delete(k)
    }
  }, 120_000)
  if (sweeper && "unref" in sweeper) (sweeper as { unref?: () => void }).unref?.()
}
ensureSweeper()

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "anon"
}

/**
 * Returns a `429` NextResponse if the caller has exceeded the rate, otherwise
 * `null` (allow the request through).
 */
export function rateLimit(
  req: NextRequest,
  opts: { limit: number; windowMs: number } = { limit: 100, windowMs: 60_000 }
): NextResponse | null {
  const key = getClientIp(req)
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.refillAt <= now) {
    buckets.set(key, { tokens: opts.limit - 1, refillAt: now + opts.windowMs })
    return null
  }
  if (bucket.tokens <= 0) {
    const retryAfter = Math.ceil((bucket.refillAt - now) / 1000)
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }
  bucket.tokens -= 1
  return null
}
