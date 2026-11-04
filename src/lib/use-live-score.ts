"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { LiveMatchState } from "./scoring"

/**
 * Subscribe to a match's live scoring state and (for the operator) push new
 * states as balls are scored. Connects to the score-service mini service via
 * the Caddy gateway using the XTransformPort query param.
 *
 * @param matchId  The match being scored (null when none is selected).
 * @param token    The signed scorer session token. Sent with every
 *                 `operator:state` / `operator:clear` emit so the
 *                 score-service can verify the scorer is permitted to write
 *                 to this match (token carries their tournamentIds).
 *                 Pass null when not authenticated — emits will be no-ops.
 *
 * Returns:
 *   - liveState:       the current cached match state (null if none)
 *   - connected:       whether the WebSocket is currently connected
 *   - stateReceived:   whether we've received the FIRST state event after
 *                      mounting/subscribing. Used by the live scorer to
 *                      distinguish "reconnecting — don't show setup screen
 *                      yet" from "server confirmed no state — show setup".
 *                      Resets to false whenever matchId changes.
 *   - pushState:       operator-only — broadcast a new state
 *   - clearState:      operator-only — clear the cached state
 */
export function useLiveScore(matchId: string | null, token: string | null) {
  const [liveState, setLiveState] = useState<LiveMatchState | null>(null)
  const [connected, setConnected] = useState(false)
  // Tracks whether we've received the initial state snapshot after
  // subscribing. Without this, the scorer sees a flash of the setup screen
  // every time it navigates away + back (liveState is null for the brief
  // window between mount and the first `state` event arriving).
  const [stateReceived, setStateReceived] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const tokenRef = useRef<string | null>(token)

  // Keep the latest token available to pushState/clearState without forcing
  // a socket reconnect on every token change.
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    if (!matchId) return
    // Reset for the new match — we haven't received its state yet.
    // Deferred to a microtask so it's not synchronous setState-in-effect
    // (the react-hooks rule flags that). The reset is a one-shot and is
    // harmless if it runs after unmount (React 18+ no-ops setState on
    // unmounted components).
    queueMicrotask(() => {
      setStateReceived(false)
      setLiveState(null)
    })

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
        // Mark that we've received the initial snapshot — the scorer can
        // now safely decide whether to show the setup screen (state was
        // genuinely null) or the scoring interface.
        setStateReceived(true)
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
      const tok = tokenRef.current
      if (!tok) return
      socket.emit("operator:state", { matchId, state, token: tok })
    },
    [matchId]
  )

  const clearState = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !matchId) return
    const tok = tokenRef.current
    if (!tok) return
    socket.emit("operator:clear", { matchId, token: tok })
  }, [matchId])

  return { liveState, connected, stateReceived, pushState, clearState }
}
