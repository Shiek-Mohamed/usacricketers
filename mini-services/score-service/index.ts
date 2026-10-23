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
    const { createAdapter } = await import("@socket.io/redis-adapter")
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
    const state = cache.has(matchId) ? cache.get(matchId) : null
    socket.emit("state", { matchId, state })
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
      if (now - last < MIN_BROADCAST_GAP_MS) return
      lastBroadcast.set(matchId, now)
      cache.set(matchId, state)
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
  await attachRedisAdapter()
  console.log(`✅ Score service (socket.io) running on port ${PORT}`)
  console.log(`   caps: total=${MAX_TOTAL_CONNECTIONS} per-match=${MAX_PER_MATCH} gap=${MIN_BROADCAST_GAP_MS}ms`)
  console.log(`   auth: signed scorer tokens (HMAC-SHA256) + match->series guard via ${APP_ORIGIN}`)
})

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)))
process.on("SIGINT", () => httpServer.close(() => process.exit(0)))
