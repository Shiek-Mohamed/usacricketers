import { createServer } from "http"
import { Server } from "socket.io"
import { createHmac, timingSafeEqual } from "crypto"

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to forward to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
})

/* ------------------------------ configuration ------------------------------ */

const SCORER_SECRET = process.env.SCORER_SECRET || "cric-cms-scorer-secret-change-me"
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "cric-cms-internal-change-me"
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000"
const REDIS_URL = process.env.REDIS_URL || "" // optional; enables horizontal scaling

const MAX_TOTAL_CONNECTIONS = Number(process.env.MAX_TOTAL_CONNECTIONS) || 5000
const MAX_PER_MATCH = Number(process.env.MAX_PER_MATCH) || 2000
const MIN_BROADCAST_GAP_MS = Number(process.env.MIN_BROADCAST_GAP_MS) || 80

/**
 * Warn loudly (console.warn) at boot if either shared secret is still the
 * default value shipped in source. Does NOT throw — failing fast would
 * break local dev where the defaults are convenient. Mirrors the same-named
 * export in `src/lib/scorer-auth.ts` so the warning fires consistently on
 * both the Next.js API side and the score-service.
 *
 * Kept local (not imported from src/lib/scorer-auth) because the
 * score-service is a standalone bun project and importing scorer-auth would
 * pull in the Prisma db client (an unwanted heavy dep for this service).
 */
function warnIfDefaultSecrets(): void {
  if (
    !process.env.SCORER_SECRET ||
    process.env.SCORER_SECRET === "cric-cms-scorer-secret-change-me"
  ) {
    console.warn(
      "[security] SCORER_SECRET is using the default value. Set SCORER_SECRET to a strong random string (e.g. `openssl rand -hex 32`) in production — the default allows anyone to forge scorer tokens."
    )
  }
  if (
    !process.env.INTERNAL_SECRET ||
    process.env.INTERNAL_SECRET === "cric-cms-internal-change-me"
  ) {
    console.warn(
      "[security] INTERNAL_SECRET is using the default value. Set INTERNAL_SECRET to a strong random string (e.g. `openssl rand -hex 32`) in production — the default allows anyone to call internal score-service endpoints."
    )
  }
}

/**
 * Optional Redis pub/sub adapter. When REDIS_URL is set, the score-service
 * can run as multiple instances behind a load balancer — a ball scored on
 * instance A fans out to viewers on instances B/C/D via Redis pub/sub. When
 * REDIS_URL is empty (or the redis packages aren't installed), the service
 * runs as a single in-memory instance (fine up to ~5K concurrent connections
 * on one box). Imports are dynamic so the service starts without the redis
 * packages installed.
 */
async function attachRedisAdapter() {
  if (!REDIS_URL) {
    console.log("   redis: disabled (single-instance mode). Set REDIS_URL to enable horizontal scaling.")
    return
  }
  try {
    // @ts-expect-error optional dependency — @socket.io/redis-adapter may not
    // be installed (single-instance mode). The dynamic import is inside a
    // try/catch so a missing package falls through to the warning below.
    const { createAdapter } = await import("@socket.io/redis-adapter")
    // @ts-expect-error optional dependency — redis may not be installed
    // (single-instance mode). Same try/catch guard as above.
    const { createClient: createRedisClient } = await import("redis")
    const pub = createRedisClient({ url: REDIS_URL })
    const sub = pub.duplicate()
    await Promise.all([pub.connect(), sub.connect()])
    io.adapter(createAdapter(pub, sub))
    console.log(`   redis: adapter attached (${REDIS_URL.replace(/:[^:@/]+@/, ":****@")}) — multi-instance fan-out enabled.`)
  } catch (e) {
    console.warn(`   redis: adapter failed (${String(e).slice(0, 120)}) — falling back to single-instance mode. (Install @socket.io/redis-adapter + redis to enable.)`)
  }
}

// matchId -> latest live state
const cache = new Map<string, unknown>()
// matchId -> last broadcast timestamp (throttle)
const lastBroadcast = new Map<string, number>()
// matchId -> seriesId (resolved once from the app; cached for the process life)
const matchSeries = new Map<string, string | null>()
// matchId -> inflight series-resolution promise (dedupe concurrent lookups)
const matchSeriesPending = new Map<string, Promise<string | null>>()
// matchId -> inflight state-fetch promise (dedupe concurrent DB lookups so
// a burst of viewers on a freshly-deployed instance shares one fetch).
const matchStatePending = new Map<string, Promise<unknown>>()

function roomSize(matchId: string): number {
  const room = io.sockets.adapter.rooms.get(`match:${matchId}`)
  return room ? room.size : 0
}

/* --------------------------- token verification --------------------------- */

interface TokenPayload {
  scorerId: string
  name?: string
  username?: string
  tournamentIds: string[]
  exp: number
}

function b64urlDecode(s: string): Buffer {
  // Node 18+ Buffer supports base64url
  return Buffer.from(s, "base64url")
}

function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token || typeof token !== "string") return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const expected = createHmac("sha256", SCORER_SECRET).update(payload).digest("base64url")
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let body: TokenPayload
  try {
    body = JSON.parse(b64urlDecode(payload).toString("utf8"))
  } catch {
    return null
  }
  if (!body || typeof body.exp !== "number" || body.exp < Date.now()) return null
  if (!body.scorerId || !Array.isArray(body.tournamentIds)) return null
  return body
}

/* ----------------------- match -> series resolution ----------------------- */

async function resolveMatchSeries(matchId: string): Promise<string | null> {
  if (matchSeries.has(matchId)) return matchSeries.get(matchId)!
  // Dedupe concurrent resolutions for the same match.
  const inflight = matchSeriesPending.get(matchId)
  if (inflight) return inflight
  const p = (async () => {
    try {
      const res = await fetch(
        `${APP_ORIGIN}/api/internal/match-series?matchId=${encodeURIComponent(matchId)}`,
        { headers: { "x-internal-secret": INTERNAL_SECRET } }
      )
      if (!res.ok) {
        // 404 means unknown match — treat as "no series" (deny).
        matchSeries.set(matchId, null)
        return null
      }
      const data = (await res.json()) as { seriesId: string | null }
      matchSeries.set(matchId, data.seriesId)
      return data.seriesId
    } catch {
      // Network error — don't cache a negative; let the next attempt retry.
      return null
    } finally {
      matchSeriesPending.delete(matchId)
    }
  })()
  matchSeriesPending.set(matchId, p)
  return p
}

/* ------------- DB fallback: hydrate state from Match.liveStateJson ----------- */

/**
 * Fetch the latest persisted LiveMatchState for a match from the Next.js API
 * (GET /api/matches/[id] is public and returns `liveStateJson` as a string
 * on the serialized Match). Used to hydrate the in-memory cache when a
 * viewer subscribes to a match the score-service has no cached state for —
 * the common trigger is a fly.io deploy that wipes the Map but leaves the
 * DB with the scorer's last persist() snapshot. Without this, viewers see
 * "waiting for scorer" indefinitely even though Match.liveStateJson has
 * the state.
 *
 * Behaviour:
 *   • If the cache already has the match, return the cached value (no fetch).
 *   • If the cache is empty, fetch GET /api/matches/[id], parse
 *     `liveStateJson`, cache the result (state OR null) and return it.
 *   • Concurrent calls for the same match share one fetch (matchStatePending).
 *   • On network error: do NOT cache the failure (so the next subscriber can
 *     retry) and return null.
 *   • On malformed JSON or a missing liveStateJson field: cache null (so we
 *     don't re-fetch on every subscriber for a match that genuinely has no
 *     state yet — once the scorer pushes operator:state the cache updates).
 *
 * The fetch is non-blocking — callers (the subscribe handler) emit a null
 * placeholder immediately and then emit the DB state to the socket when the
 * promise resolves, so a slow API doesn't stall the subscribe handshake.
 */
function fetchMatchState(matchId: string): Promise<unknown> {
  if (cache.has(matchId)) {
    // Cache hit (could be a real state OR a cached null sentinel).
    return Promise.resolve(cache.get(matchId) ?? null)
  }
  const inflight = matchStatePending.get(matchId)
  if (inflight) return inflight
  const p = (async () => {
    let parsed: unknown = null
    let networkError = false
    try {
      const res = await fetch(
        `${APP_ORIGIN}/api/matches/${encodeURIComponent(matchId)}`
      )
      if (res.ok) {
        const match = (await res.json()) as { liveStateJson?: string | null }
        const raw = match?.liveStateJson
        if (raw) {
          try {
            parsed = JSON.parse(raw)
          } catch {
            // Malformed JSON — treat as no state. Cached below as null.
            parsed = null
          }
        }
      }
    } catch {
      // Network error — don't cache the failure so the next subscriber
      // can retry once the API is reachable again.
      networkError = true
    }
    if (!networkError) {
      // Cache state OR null so subsequent subscribers don't re-fetch. A
      // later operator:state event from the scorer overrides this with the
      // fresh live state.
      cache.set(matchId, parsed)
    }
    return parsed
  })()
  matchStatePending.set(matchId, p)
  // Clean up the inflight marker once the fetch settles so a later retry
  // (after a network error) can run.
  p.finally(() => matchStatePending.delete(matchId))
  return p
}

/* ------------------------------- connection ------------------------------- */

io.on("connection", (socket) => {
  if (io.engine.clientsCount > MAX_TOTAL_CONNECTIONS) {
    socket.emit("error", { message: "Server at capacity. Try again shortly." })
    socket.disconnect(true)
    return
  }

  // A viewer (or operator) subscribes to a match's live updates.
  socket.on("subscribe", (matchId: string) => {
    if (!matchId || typeof matchId !== "string") return
    const size = roomSize(matchId)
    if (size >= MAX_PER_MATCH) {
      socket.emit("error", { message: `Match room is full (${MAX_PER_MATCH}).` })
      return
    }
    socket.join(`match:${matchId}`)
    socket.data.matchId = matchId

    // Fast path: cache already has the state (or a cached null sentinel).
    if (cache.has(matchId)) {
      socket.emit("state", { matchId, state: cache.get(matchId) ?? null })
      return
    }

    // Slow path: no cached state. Emit a null placeholder immediately so the
    // viewer isn't blocked, then asynchronously fetch the latest persisted
    // state from Match.liveStateJson (DB is the source of truth across
    // deploys). When the fetch resolves, emit the DB state to THIS socket —
    // the room-wide broadcast happens via the scorer's operator:state event.
    socket.emit("state", { matchId, state: null })
    fetchMatchState(matchId)
      .then((state) => {
        if (state != null) {
          socket.emit("state", { matchId, state })
        }
      })
      .catch(() => {
        // fetchMatchState already swallows errors internally; this guard is
        // belt-and-suspenders so a rejected promise never crashes the service.
      })
  })

  socket.on("unsubscribe", (matchId: string) => {
    socket.leave(`match:${matchId}`)
  })

  // The operator pushes a new full state (after each ball/event).
  // The token MUST be a valid signed scorer token whose tournamentIds include
  // the series this match belongs to. A token carrying tournamentIds: ["*"]
  // is treated as god-mode (site-admin minted via /api/admin/scorer-token) —
  // the series lookup + membership check is skipped.
  socket.on(
    "operator:state",
    async (payload: { matchId?: string; state?: unknown; token?: string }) => {
      if (!payload || typeof payload !== "object") return
      const { matchId, state, token } = payload
      if (!matchId || typeof matchId !== "string") return

      const session = verifyToken(token)
      if (!session) {
        socket.emit("error", { message: "Unauthorized: invalid or expired scorer token" })
        return
      }

      // God-mode: skip series lookup + membership check.
      const godMode =
        session.tournamentIds.length === 1 && session.tournamentIds[0] === "*"
      if (!godMode) {
        // Resolve the match's series (cached after first lookup).
        const seriesId = await resolveMatchSeries(matchId)
        if (!seriesId || !session.tournamentIds.includes(seriesId)) {
          socket.emit("error", { message: "Forbidden: this match is not in your tournaments" })
          return
        }
      }

      // Throttle: drop broadcasts faster than MIN_BROADCAST_GAP_MS for this match
      const now = Date.now()
      const last = lastBroadcast.get(matchId) ?? 0
      if (now - last < MIN_BROADCAST_GAP_MS) {
        console.log(`[score-service] throttled broadcast for ${matchId} (${now - last}ms gap)`)
        return
      }
      lastBroadcast.set(matchId, now)
      cache.set(matchId, state)
      console.log(`[score-service] broadcasting state for ${matchId} to room match:${matchId}`)
      io.to(`match:${matchId}`).emit("state", { matchId, state })
    }
  )

  // The operator clears the live state.
  socket.on(
    "operator:clear",
    async (payload: { matchId?: string; token?: string } | string) => {
      const matchId = typeof payload === "string" ? payload : payload?.matchId
      const token = typeof payload === "string" ? undefined : payload?.token
      if (!matchId) return

      const session = verifyToken(token)
      if (!session) {
        socket.emit("error", { message: "Unauthorized: invalid or expired scorer token" })
        return
      }

      const godMode =
        session.tournamentIds.length === 1 && session.tournamentIds[0] === "*"
      if (!godMode) {
        const seriesId = await resolveMatchSeries(matchId)
        if (!seriesId || !session.tournamentIds.includes(seriesId)) {
          socket.emit("error", { message: "Forbidden: this match is not in your tournaments" })
          return
        }
      }

      cache.delete(matchId)
      lastBroadcast.delete(matchId)
      io.to(`match:${matchId}`).emit("state", { matchId, state: null })
    }
  )

  socket.on("disconnect", () => {
    // socket.io cleans up rooms automatically
  })
})

// Periodic memory hygiene: drop stale caches (no subscribers for 30 min).
setInterval(() => {
  for (const matchId of Array.from(cache.keys())) {
    if (roomSize(matchId) === 0) {
      // Eviction is cheap; keep the match->series map (bounded by #matches).
    }
  }
}, 30 * 60 * 1000).unref?.()

const PORT = 3003
httpServer.listen(PORT, async () => {
  // Fail-loud warning if the shared secrets are still the insecure defaults
  // shipped in source. Does NOT throw — see warnIfDefaultSecrets above.
  warnIfDefaultSecrets()
  await attachRedisAdapter()
  console.log(`✅ Score service (socket.io) running on port ${PORT}`)
  console.log(`   caps: total=${MAX_TOTAL_CONNECTIONS} per-match=${MAX_PER_MATCH} gap=${MIN_BROADCAST_GAP_MS}ms`)
  console.log(`   auth: signed scorer tokens (HMAC-SHA256) + match->series guard via ${APP_ORIGIN}`)
  console.log(`   hydrate: fetches Match.liveStateJson on subscribe when cache is empty (DB as source of truth)`)
})

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)))
process.on("SIGINT", () => httpServer.close(() => process.exit(0)))
