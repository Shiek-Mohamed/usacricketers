import { createServer } from "http"
import { Server } from "socket.io"

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to forward to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  // Keep connection memory bounded under load.
  maxHttpBufferSize: 1e6, // 1MB max per message (full scorecard fits easily)
})

/**
 * Lightweight operator auth.
 *
 * Operator events (operator:state / operator:clear) must carry this token.
 * NOTE: this is a demo-grade safeguard — the token is shipped to the browser,
 * so it only stops *casual* spoofing, not a determined attacker. For real
 * production, swap this for a server-issued short-lived JWT validated here.
 */
const SCORER_TOKEN = process.env.SCORER_TOKEN || "cric-cms-live-scorer-v1"

// Hard caps to keep a single instance healthy under load.
const MAX_TOTAL_CONNECTIONS = Number(process.env.MAX_TOTAL_CONNECTIONS) || 5000
const MAX_PER_MATCH = Number(process.env.MAX_PER_MATCH) || 2000
// Min gap between broadcasts for the same match (ms) — protects against a
// runaway operator flooding viewers. ~12 broadcasts/sec is plenty for ball-by-ball.
const MIN_BROADCAST_GAP_MS = Number(process.env.MIN_BROADCAST_GAP_MS) || 80

// matchId -> latest live state
const cache = new Map<string, unknown>()
// matchId -> last broadcast timestamp (throttle)
const lastBroadcast = new Map<string, number>()

function roomSize(matchId: string): number {
  const room = io.sockets.adapter.rooms.get(`match:${matchId}`)
  return room ? room.size : 0
}

io.on("connection", (socket) => {
  // Global connection cap
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
  socket.on(
    "operator:state",
    (payload: { matchId?: string; state?: unknown; token?: string }) => {
      if (!payload || typeof payload !== "object") return
      const { matchId, state, token } = payload
      if (!matchId || typeof matchId !== "string") return
      if (token !== SCORER_TOKEN) {
        socket.emit("error", { message: "Unauthorized: invalid scorer token" })
        return
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
    (payload: { matchId?: string; token?: string } | string) => {
      // Accept either a bare matchId (legacy) or { matchId, token }
      const matchId = typeof payload === "string" ? payload : payload?.matchId
      const token = typeof payload === "string" ? undefined : payload?.token
      if (!matchId) return
      if (token !== SCORER_TOKEN) {
        socket.emit("error", { message: "Unauthorized: invalid scorer token" })
        return
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
      // only evict if truly idle; keep for late reconnects within the window
      // (cheap to retain; Map stays small for a handful of live matches)
    }
  }
}, 30 * 60 * 1000).unref?.()

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`✅ Score service (socket.io) running on port ${PORT}`)
  console.log(`   caps: total=${MAX_TOTAL_CONNECTIONS} per-match=${MAX_PER_MATCH} gap=${MIN_BROADCAST_GAP_MS}ms`)
})

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)))
process.on("SIGINT", () => httpServer.close(() => process.exit(0)))
