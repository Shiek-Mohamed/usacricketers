"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { LiveMatchState } from "./scoring"

/**
 * Subscribe to a match's live scoring state and (for the operator) push new
 * states as balls are scored. Connects to the score-service mini service via
 * the Caddy gateway using the XTransformPort query param.
 */
export function useLiveScore(matchId: string | null) {
  const [liveState, setLiveState] = useState<LiveMatchState | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!matchId) return
    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on("connect", () => {
      setConnected(true)
      socket.emit("subscribe", matchId)
    })
    socket.on("disconnect", () => setConnected(false))
    socket.on("state", (payload: { matchId: string; state: unknown }) => {
      if (payload.matchId === matchId) {
        setLiveState((payload.state as LiveMatchState | null) ?? null)
      }
    })

    return () => {
      socket.emit("unsubscribe", matchId)
      socket.disconnect()
      socketRef.current = null
    }
  }, [matchId])

  /** Operator: broadcast a new full state to all subscribers. */
  const pushState = useCallback(
    (state: LiveMatchState) => {
      const socket = socketRef.current
      if (!socket || !matchId) return
      socket.emit("operator:state", { matchId, state })
    },
    [matchId]
  )

  const clearState = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !matchId) return
    socket.emit("operator:clear", matchId)
  }, [matchId])

  return { liveState, connected, pushState, clearState }
}
