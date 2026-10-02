import { createServer } from "http"
import { Server } from "socket.io"

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to forward to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// In-memory cache of the latest live state per match.
// The operator (admin Live Scorer) computes the state client-side using the
// scoring engine, saves it to the DB via the matches API, and broadcasts it
// here. This service is a dumb relay + cache so viewers get instant updates.
const cache = new Map<string, unknown>()

io.on("connection", (socket) => {
  // A viewer (or operator) subscribes to a match's live updates.
  socket.on("subscribe", (matchId: string) => {
    if (!matchId) return
    socket.join(`match:${matchId}`)
    const state = cache.has(matchId) ? cache.get(matchId) : null
    socket.emit("state", { matchId, state })
  })

  socket.on("unsubscribe", (matchId: string) => {
    socket.leave(`match:${matchId}`)
  })

  // The operator pushes a new full state (after each ball/event).
  socket.on(
    "operator:state",
    ({ matchId, state }: { matchId: string; state: unknown }) => {
      if (!matchId) return
      cache.set(matchId, state)
      io.to(`match:${matchId}`).emit("state", { matchId, state })
    }
  )

  // The operator clears the live state (e.g. match ended / reset).
  socket.on("operator:clear", (matchId: string) => {
    cache.delete(matchId)
    io.to(`match:${matchId}`).emit("state", { matchId, state: null })
  })

  socket.on("disconnect", () => {
    // rooms are auto-cleaned by socket.io
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`✅ Score service (socket.io) running on port ${PORT}`)
})

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0))
})
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0))
})
