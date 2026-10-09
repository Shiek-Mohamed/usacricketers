/**
 * Simple in-process TTL cache (local memory).
 *
 * Use `cacheWrap` to memoise the result of an async producer for a short TTL.
 * This is intentionally process-local (no Redis) — it cuts repeated DB work
 * within a single server instance, which is the common hot path.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

// Periodically sweep expired entries to keep memory bounded.
let sweeper: ReturnType<typeof setInterval> | null = null
function ensureSweeper() {
  if (sweeper || typeof setInterval === "undefined") return
  sweeper = setInterval(
    () => {
      const now = Date.now()
      for (const [k, v] of store) {
        if (v.expiresAt <= now) store.delete(k)
      }
    },
    60_000
  )
  if (typeof sweeper !== "undefined" && "unref" in sweeper) {
    ;(sweeper as { unref?: () => void }).unref?.()
  }
}
ensureSweeper()

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs = 10_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/**
 * Return the cached value for `key` if fresh, else call `producer`, cache and
 * return its result.
 */
export async function cacheWrap<T>(
  key: string,
  producer: () => Promise<T>,
  ttlMs = 10_000
): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== undefined) return hit
  const value = await producer()
  cacheSet(key, value, ttlMs)
  return value
}

/** Invalidate a single cache key (call on writes that affect it). */
export function cacheDel(key: string): void {
  store.delete(key)
}

/** Invalidate all keys that start with `prefix` (e.g. all list pages for an entity). */
export function cacheDelPrefix(prefix: string): void {
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

/** Clear the entire cache (tests / admin "flush" action). */
export function cacheClear(): void {
  store.clear()
}
